import { pool, query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';
import crypto from 'crypto';
import { sendShipmentNotifications } from '../utils/email.js';

const generateTrackingNumber = () => {
    return 'HER-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

export const bookShipment = async (req, res) => {
    const {
        sender,
        receiver,
        packages,
        serviceOptionId,
        insurancePolicyId,
        serviceType, // 'import' | 'export'
        pickupCountryId,
        destinationCountryId,
        pickupCityId,
        destinationCityId,
        saveSenderAddress,
        saveReceiverAddress
    } = req.body;

    // 1. Basic Validation
    if (!sender || !receiver || !packages || packages.length === 0 || !serviceOptionId || !serviceType) {
        return error(res, 'Missing required booking fields', 400);
    }
    
    // Payment Method Validation (Required for booking)
    // Client should send paymentMethodId for the selected provider.
    // If not sent, we could default or error. Let's error since prompt implies it's part of payload.
    const methodId = req.body.paymentMethodId;
    if (!methodId) {
        return error(res, 'Payment method is required', 400);
    }

    const userId = req.user ? req.user.id : null;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // --- 2. Calculate/Verify Pricing ---
        
        // A. Calculate Total Weight & Value
        let totalWeight = 0;
        let totalVolumetric = 0;
        let totalValue = 0;

        packages.forEach(pkg => {
            const w = Number(pkg.weight);
            const v = Number(pkg.value) || 0;
            const q = Number(pkg.quantity) || 1;
            
            // Volumetric: (L x W x H) / 5000
            if (pkg.length && pkg.width && pkg.height) {
                const vol = (Number(pkg.length) * Number(pkg.width) * Number(pkg.height)) / 5000;
                totalVolumetric += (vol * q);
            }
            totalWeight += (w * q);
            totalValue += (v * q);
        });

        const chargeableWeight = Math.max(totalWeight, totalVolumetric);

        // B. Get Shipping Rate
        const rateQuery = `
            SELECT r.* 
            FROM shipping_rates r
            JOIN shipment_options o ON r.shipment_option_id = o.id
            WHERE r.shipment_option_id = $1
            AND r.pickup_country_id = $2
            AND r.destination_country_id = $3
            AND (r.pickup_city_id IS NULL OR r.pickup_city_id = $4)
            AND (r.destination_city_id IS NULL OR r.destination_city_id = $5)
            AND r.service_type = $6
            AND $7 >= r.min_weight
            AND $7 <= r.max_weight
            ORDER BY ((r.pickup_city_id IS NOT NULL)::int + (r.destination_city_id IS NOT NULL)::int) DESC
            LIMIT 1
        `;

        const queryParams = [
            serviceOptionId, pickupCountryId, destinationCountryId, 
            pickupCityId || null, destinationCityId || null, 
            serviceType, chargeableWeight
        ];
        
        const rateRes = await client.query(rateQuery, queryParams);

        if (rateRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return error(res, 'Selected shipping option is not valid for this route/weight', 400);
        }

        const rate = rateRes.rows[0];
        const shippingFee = Number(rate.base_fee) + (chargeableWeight * Number(rate.rate_per_kg));

        // C. Calculate Insurance Fee
        let insuranceFee = 0;
        if (insurancePolicyId) {
            const insRes = await client.query('SELECT * FROM insurance_policies WHERE id = $1 AND is_active = TRUE', [insurancePolicyId]);
            if (insRes.rows.length === 0) {
                 await client.query('ROLLBACK');
                 return error(res, 'Invalid insurance policy', 400);
            }
            const policy = insRes.rows[0];
            
            if (policy.fee_type === 'flat') {
                insuranceFee = Number(policy.fee_amount);
            } else {
                insuranceFee = (totalValue * (Number(policy.fee_amount) / 100));
            }
             if (Number(policy.min_fee) > 0 && insuranceFee < Number(policy.min_fee) && policy.fee_type === 'percentage') {
                 insuranceFee = Number(policy.min_fee);
            }
        }

        const totalPrice = Math.round(shippingFee + insuranceFee);

        // --- 2.5 Verify Payment Method & Snapshot ---
        const paymentRes = await client.query('SELECT * FROM payment_methods WHERE id = $1 AND is_active = TRUE', [methodId]);
        if (paymentRes.rows.length === 0) {
             await client.query('ROLLBACK');
             return error(res, 'Invalid or inactive payment method', 400);
        }
        const paymentMethod = paymentRes.rows[0];
        // Snapshot: { provider: 'bank_transfer', name: 'Bank...', config: { ... } }
        const paymentSnapshot = {
            id: paymentMethod.id,
            provider: paymentMethod.provider,
            name: paymentMethod.name,
            config: paymentMethod.config
        };

        // --- WALLET PAYMENT LOGIC ---
        let initialStatus = 'pending';
        let walletTransactionData = null; // Store data to insert after shipment creation

        if (paymentMethod.provider === 'wallet') {
            if (!userId) {
                await client.query('ROLLBACK');
                return error(res, 'You must be logged in to pay with wallet', 401);
            }

            // Lock Wallet Row
            const walletRes = await client.query('SELECT * FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
            if (walletRes.rows.length === 0 || !walletRes.rows[0].is_active) {
                 await client.query('ROLLBACK');
                 return error(res, 'Wallet not active or not found', 400);
            }

            const wallet = walletRes.rows[0];
            const balance = Number(wallet.balance);

            if (balance < totalPrice) {
                 await client.query('ROLLBACK');
                 return error(res, 'Insufficient wallet balance', 400);
            }

            // Debit Wallet
            const newBalance = balance - totalPrice;
            await client.query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.id]);

            initialStatus = 'paid';
            
            // Prepare transaction data
            walletTransactionData = {
                walletId: wallet.id,
                amount: totalPrice,
                balanceBefore: balance,
                balanceAfter: newBalance
            };
        }

        // --- 3. Create Shipment ---
        const trackingNumber = generateTrackingNumber();

        const shipmentRes = await client.query(
            `INSERT INTO shipments (
                tracking_number, user_id, status, service_type, 
                shipment_option_id, insurance_policy_id, 
                shipping_fee, insurance_fee, total_price, currency,
                payment_method
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'NGN', $10) RETURNING id`,
            [trackingNumber, userId, initialStatus, serviceType, serviceOptionId, insurancePolicyId || null, shippingFee, insuranceFee, totalPrice, paymentSnapshot]
        );
        const shipmentId = shipmentRes.rows[0].id;

        // --- WALLET PART 2: Record Transaction ---
        if (walletTransactionData) {
            await client.query(
                 `INSERT INTO wallet_transactions 
                  (wallet_id, type, amount, balance_before, balance_after, reference, description, status, meta_data)
                  VALUES ($1, 'debit', $2, $3, $4, $5, $6, 'success', $7)`,
                  [
                      walletTransactionData.walletId, 
                      walletTransactionData.amount, 
                      walletTransactionData.balanceBefore, 
                      walletTransactionData.balanceAfter, 
                      trackingNumber, 
                      'Payment for Shipment', 
                      JSON.stringify({ shipment_id: shipmentId })
                  ]
            );
        }

        // --- 4. Save Shipment Addresses (Snapshot) ---
        const addAddress = async (type, data) => {
            await client.query(
                `INSERT INTO shipment_addresses (
                    shipment_id, type, name, email, phone, 
                    country, state, city, address, postal_code
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [shipmentId, type, data.name, data.email, data.phone, data.country, data.state, data.city, data.address, data.postal_code]
            );
        };
        await addAddress('sender', sender);
        await addAddress('receiver', receiver);

        // --- 5. Save Packages ---
        for (const pkg of packages) {
            await client.query(
                `INSERT INTO shipment_packages (
                    shipment_id, category, description, weight, 
                    length, width, height, value, quantity
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [shipmentId, pkg.category, pkg.description, pkg.weight, pkg.length, pkg.width, pkg.height, pkg.value, pkg.quantity || 1]
            );
        }

        // --- 6. Save to Address Book (Optional Auth Feature) ---
        if (userId) {
            const saveToBook = async (type, data) => {
                await client.query(
                    `INSERT INTO addresses (
                        user_id, type, name, email, phone, 
                        country, state, city, address, postal_code
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                    [userId, type, data.name, data.email, data.phone, data.country, data.state, data.city, data.address, data.postal_code]
                );
            };

            if (saveSenderAddress) await saveToBook('sender', sender);
            if (saveReceiverAddress) await saveToBook('receiver', receiver);
        }

        await client.query('COMMIT');

        // --- 7. Send Notifications (Async - don't block response) ---
        sendShipmentNotifications({
            trackingNumber,
            sender: { name: sender.name, email: sender.email },
            receiver: { name: receiver.name, email: receiver.email },
            totalPrice,
            paymentMethod: paymentSnapshot
        }).catch(err => console.error('Notification Error:', err));

        return success(res, 'Shipment booked successfully', {
            shipmentId,
            trackingNumber,
            totalPrice,
            currency: 'NGN',
            status: 'pending',
            paymentMethod: paymentSnapshot
        }, 201);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Booking Error:', err);
        return error(res, 'Failed to book shipment', 500);
    } finally {
        client.release();
    }
};

export const calculateRates = async (req, res) => {
    const {
        sender,
        receiver,
        packages,
        serviceType // 'import' | 'export'
    } = req.body;

    // 1. Basic Validation
    if (!sender || !receiver || !packages || packages.length === 0 || !serviceType) {
        return error(res, 'Missing required fields (sender, receiver, packages, serviceType)', 400);
    }

    try {
        // --- 2. Resolve Locations ---
        const getCountryId = async (countryName, countryId) => {
            if (countryId) return countryId;
            if (!countryName) return null;
            const res = await query('SELECT id FROM countries WHERE LOWER(name) = LOWER($1) AND is_active = TRUE', [countryName]);
            return res.rows.length > 0 ? res.rows[0].id : null;
        };

        const pickupCountryId = await getCountryId(sender.country, sender.countryId);
        const destinationCountryId = await getCountryId(receiver.country, receiver.countryId);

        if (!pickupCountryId) return error(res, `Invalid or unsupported pickup country: ${sender.country}`, 400);
        if (!destinationCountryId) return error(res, `Invalid or unsupported destination country: ${receiver.country}`, 400);

        // --- 3. Aggregate Weight & Value ---
        let totalWeight = 0;
        let totalVolumetric = 0;
        let totalValue = 0;

        packages.forEach(pkg => {
            const w = Number(pkg.weight);
            const v = Number(pkg.value) || 0;
            const q = Number(pkg.quantity) || 1;
            
            if (pkg.length && pkg.width && pkg.height) {
                const vol = (Number(pkg.length) * Number(pkg.width) * Number(pkg.height)) / 5000;
                totalVolumetric += (vol * q);
            }
            totalWeight += (w * q);
            totalValue += (v * q);
        });

        const chargeableWeight = Math.max(totalWeight, totalVolumetric);

        // --- 4. Fetch Shipping Rates ---
        const rateQuery = `
            SELECT DISTINCT ON (r.shipment_option_id)
                r.id, r.base_fee, r.rate_per_kg, r.min_weight, r.max_weight,
                o.id as option_id, o.name AS option_name, o.description AS option_desc, 
                o.min_days, o.max_days
            FROM shipping_rates r
            JOIN shipment_options o ON r.shipment_option_id = o.id
            WHERE 
                r.pickup_country_id = $1
                AND r.destination_country_id = $2
                AND r.service_type = $3
                AND $4 >= r.min_weight
                AND $4 <= r.max_weight
                AND o.is_active = true
            ORDER BY r.shipment_option_id, ((r.pickup_city_id IS NOT NULL)::int + (r.destination_city_id IS NOT NULL)::int) DESC
        `;

        const ratesRes = await query(rateQuery, [
            pickupCountryId, destinationCountryId, serviceType, chargeableWeight
        ]);

        const quotes = ratesRes.rows.map(r => {
            const base = Number(r.base_fee);
            const perKg = Number(r.rate_per_kg);
            const total = Math.round(base + (chargeableWeight * perKg));

            return {
                id: r.option_id,
                name: r.option_name,
                description: r.option_desc || '',
                price: total,
                formattedPrice: `₦${total.toLocaleString('en-NG')}`,
                eta: `${r.min_days} - ${r.max_days} Working days`,
                slug: r.option_name.toLowerCase().replace(/\s+/g, '-'),
            };
        });

        // --- 5. Fetch Insurance Options ---
        const insuranceRes = await query('SELECT * FROM insurance_policies WHERE is_active = TRUE');
        const insuranceOptions = insuranceRes.rows.map(p => {
            let fee = 0;
            if (p.fee_type === 'flat') {
                fee = Number(p.fee_amount);
            } else {
                fee = (totalValue * (Number(p.fee_amount) / 100));
            }
             if (Number(p.min_fee) > 0 && fee < Number(p.min_fee) && p.fee_type === 'percentage') {
                 fee = Number(p.min_fee);
            }

            return {
                id: p.id,
                name: p.name,
                description: p.description,
                fee: fee,
                formattedFee: fee === 0 ? 'Free' : `₦${fee.toLocaleString('en-NG')}`,
                coverage: p.coverage_percentage
            };
        });

        return success(res, 'Rates calculated successfully', {
            quotes,
            insuranceOptions,
            summary: {
                totalWeight,
                totalVolumetric,
                chargeableWeight,
                totalValue,
                currency: 'NGN'
            }
        });

    } catch (err) {
        console.error('Calculate Rates Error:', err);
        return error(res, 'Failed to calculate rates', 500);
    }
};

// --- User Dashboard Endpoints ---

export const getUserRecentShipments = async (req, res) => {
    const userId = req.user.id;
    try {
        // Fetch recent shipments with receiver name
        // We join with shipment_addresses to get the receiver name specifically
        const result = await query(
            `SELECT s.id, s.tracking_number, s.total_price, s.created_at, s.status,
                    sa.name as receiver_name
             FROM shipments s
             LEFT JOIN shipment_addresses sa ON s.id = sa.shipment_id AND sa.type = 'receiver'
             WHERE s.user_id = $1
             ORDER BY s.created_at DESC
             LIMIT 5`,
            [userId]
        );

        const shipments = result.rows.map(s => ({
            id: s.id,
            trackingNumber: s.tracking_number,
            receiver: s.receiver_name,
            amount: s.total_price,
            date: s.created_at, // Format in frontend or here if specific format needed
            status: s.status
        }));

        return success(res, 'Recent shipments fetched', shipments);
    } catch (err) {
        console.error('Get User Recent Shipments Error:', err);
        return error(res, 'Failed to get recent shipments', 500);
    }
};

export const getUserPendingShipmentCount = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await query(
            `SELECT COUNT(*) as count FROM shipments WHERE user_id = $1 AND status = 'pending'`,
            [userId]
        );
        return success(res, 'Pending shipment count fetched', { count: Number(result.rows[0].count) });
    } catch (err) {
         console.error('Get User Pending Count Error:', err);
        return error(res, 'Failed to get pending shipment count', 500);
    }
};

export const getUserTotalShipmentCount = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await query(
            `SELECT COUNT(*) as count FROM shipments WHERE user_id = $1`,
            [userId]
        );
        return success(res, 'Total shipment count fetched', { count: Number(result.rows[0].count) });
    } catch (err) {
         console.error('Get User Total Count Error:', err);
        return error(res, 'Failed to get total shipment count', 500);
    }
};

// --- Admin Dashboard Endpoints ---

export const getAdminRecentShipments = async (req, res) => {
    try {
        // Similar to user but no user_id filter (or all)
        const result = await query(
            `SELECT s.id, s.tracking_number, s.total_price, s.created_at, s.status,
                    sa.name as receiver_name,
                    u.first_name, u.last_name, u.email as user_email
             FROM shipments s
             LEFT JOIN shipment_addresses sa ON s.id = sa.shipment_id AND sa.type = 'receiver'
             LEFT JOIN users u ON s.user_id = u.id
             ORDER BY s.created_at DESC
             LIMIT 10`
        );

         const shipments = result.rows.map(s => ({
            id: s.id,
            trackingNumber: s.tracking_number,
            receiver: s.receiver_name,
            senderName: s.first_name ? `${s.first_name} ${s.last_name}` : 'Guest/Unknown', 
            amount: s.total_price,
            date: s.created_at,
            status: s.status
        }));

        return success(res, 'All recent shipments fetched', shipments);
    } catch (err) {
        console.error('Get Admin Recent Shipments Error:', err);
        return error(res, 'Failed to get all recent shipments', 500);
    }
};

export const getAdminPendingShipmentCount = async (req, res) => {
     try {
        const result = await query(
            `SELECT COUNT(*) as count FROM shipments WHERE status = 'pending'`
        );
        return success(res, 'All pending shipment count fetched', { count: Number(result.rows[0].count) });
    } catch (err) {
         console.error('Get Admin Pending Count Error:', err);
        return error(res, 'Failed to get all pending shipment count', 500);
    }
};

export const getAdminTotalShipmentCount = async (req, res) => {
     try {
        const result = await query(
            `SELECT COUNT(*) as count FROM shipments`
        );
        return success(res, 'All total shipment count fetched', { count: Number(result.rows[0].count) });
    } catch (err) {
         console.error('Get Admin Total Count Error:', err);
        return error(res, 'Failed to get all total shipment count', 500);
    }
};
