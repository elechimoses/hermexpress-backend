import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';
import { initializePayment, verifyPayment } from '../services/payment.service.js';
import { sendShipmentNotifications } from '../utils/email.js';

// Public: Get Active Methods
export const getPaymentMethods = async (req, res) => {
    try {
        const result = await query(
            'SELECT id, provider, name, description, config FROM payment_methods WHERE is_active = TRUE'
        );
        return success(res, 'Active payment methods', result.rows);
    } catch (err) {
        console.error('Get Payment Methods Error:', err);
        return error(res, 'Failed to fetch payment methods', 500);
    }
};

// Admin: Get All Methods
export const getAllPaymentMethods = async (req, res) => {
    try {
        const result = await query('SELECT * FROM payment_methods ORDER BY id ASC');
        return success(res, 'All payment methods', result.rows);
    } catch (err) {
        console.error('Admin Get Payments Error:', err);
        return error(res, 'Failed to fetch payment methods', 500);
    }
};

// Admin: Update Method (Toggle/Config)
export const updatePaymentMethod = async (req, res) => {
    const { id } = req.params;
    const { is_active, config } = req.body;

    try {
        // Build dynamic update query
        let updateQuery = 'UPDATE payment_methods SET updated_at = NOW()';
        const params = [];
        let paramIndex = 1;

        if (is_active !== undefined) {
            updateQuery += `, is_active = $${paramIndex}`;
            params.push(is_active);
            paramIndex++;
        }

        if (config !== undefined) {
            updateQuery += `, config = $${paramIndex}`;
            params.push(config);
            paramIndex++;
        }

        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
        params.push(id);

        const result = await query(updateQuery, params);

        if (result.rows.length === 0) {
            return error(res, 'Payment method not found', 404);
        }

        return success(res, 'Payment method updated', result.rows[0]);
    } catch (err) {
        console.error('Update Payment Error:', err);
        return error(res, 'Failed to update payment method', 500);
    }
};

// Admin: Add New Payment Method
export const addPaymentMethods = async (req, res) => {
    const { provider, name, description, is_active, config } = req.body;

    if (!provider || !name) {
        return error(res, 'Provider and Name are required', 400);
    }

    try {
        const result = await query(
            `INSERT INTO payment_methods (provider, name, description, is_active, config)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [provider, name, description, is_active !== undefined ? is_active : false, config || {}]
        );
        return success(res, 'Payment method added', result.rows[0], 201);
    } catch (err) {
        console.error('Add Payment Method Error:', err);
        if (err.code === '23505') { // Unique violation
            return error(res, 'Payment provider already exists', 409);
        }
        return error(res, 'Failed to add payment method', 500);
    }
};

// Public: Initialize Payment Transaction
export const initializeTransaction = async (req, res) => {
    const { shipmentId } = req.body;

    if (!shipmentId) {
        return error(res, 'Shipment ID is required', 400);
    }

    try {
        // 1. Fetch Shipment & User Details
        // We join with shipment_addresses to get sender details (for email/name)
        const shipmentRes = await query(`
            SELECT s.*, sa.name as sender_name, sa.email as sender_email
            FROM shipments s
            LEFT JOIN shipment_addresses sa ON s.id = sa.shipment_id AND sa.type = 'sender'
            WHERE s.id = $1
        `, [shipmentId]);

        if (shipmentRes.rows.length === 0) {
            return error(res, 'Shipment not found', 404);
        }

        const shipment = shipmentRes.rows[0];
        
        // 2. Validate Payment Method
        if (!shipment.payment_method || !shipment.payment_method.provider) {
            return error(res, 'No payment method selected for this shipment', 400);
        }

        // 3. Initialize via Service
        const result = await initializePayment({
            provider: shipment.payment_method.provider,
            config: shipment.payment_method.config || {},
            amount: Number(shipment.total_price),
            email: shipment.sender_email,
            name: shipment.sender_name,
            trackingNumber: shipment.tracking_number,
            shipmentId: shipment.id
        });

        return success(res, 'Payment initialized', result);

    } catch (err) {
        console.error('Payment Init Error:', err);
        return error(res, err.message || 'Payment initialization failed', 500);
    }
};

// Public: Handle Payment Callback
export const handlePaymentCallback = async (req, res) => {
 // 'paystack' or 'korapay'
    const { provider } = req.params;
    const { reference, trxref } = req.query;// Paystack uses trxref sometimes, but mostly reference

    const paymentRef = reference || trxref;

    console.log('Payment Reference:', paymentRef);

    if (!paymentRef) {
        return error(res, 'No payment reference found', 400);
    }

    try {
        // 1. Verify Payment with Provider
        const verification = await verifyPayment(provider, paymentRef);
        console.log('Payment Verification:', verification);

        if (!verification.success) {
           return error(res, 'Payment verification failed', 400);
        }

        // 2. Get Shipment Identifier from Metadata
        // Paystack: data.metadata.tracking_number
        // Korapay: data.metadata.tracking_number
        const mechanismData = verification.data;
        const trackingNumber = mechanismData.metadata?.tracking_number;

        if (!trackingNumber) {
            console.error('No tracking number in payment metadata');
            return error(res, 'No tracking number in payment metadata', 400);
            //return res.redirect(`${process.env.APP_URL}/?error=Invalid payment metadata`);
        }

        // 3. Find Shipment & Check Status
        const shipmentRes = await query(
            `SELECT s.*, sa.name as sender_name, sa.email as sender_email,
                    ra.name as receiver_name, ra.email as receiver_email
             FROM shipments s
             LEFT JOIN shipment_addresses sa ON s.id = sa.shipment_id AND sa.type = 'sender'
             LEFT JOIN shipment_addresses ra ON s.id = ra.shipment_id AND ra.type = 'receiver'
             WHERE s.tracking_number = $1`,
            [trackingNumber]
        );

        if (shipmentRes.rows.length === 0) {
            return res.redirect(`${process.env.APP_URL}/?error=Shipment not found`);
        }

        const shipment = shipmentRes.rows[0];

        if (shipment.status === 'paid') {
             return res.redirect(`${process.env.APP_URL}/tracking/${trackingNumber}?success=Payment already confirmed`);
        }

        // 4. Update Shipment Status
        // Update payment_method snapshot with verified reference if needed? 
        // We'll just update status and paid_at. 
        // Ideally we should also store the transaction ref in shipments table if there's a column, 
        // or update the payment_method jsonb to include the external reference.
        
        // Let's update the payment_method jsonb to include the paymentRef
        const updatedPaymentMethod = {
            ...shipment.payment_method,
            transactionReference: paymentRef,
            verifiedAt: new Date()
        };

        await query(
            `UPDATE shipments 
             SET status = 'paid',payment_method = $1 
             WHERE id = $2`,
            [updatedPaymentMethod, shipment.id]
        );

        // 5. Add Tracking History (if table exists - assuming 'tracking_statuses')
        // We will try this inside a try/catch block so it doesn't break the flow if table missing
        try {
            await query(
                `INSERT INTO tracking_statuses (shipment_id, status, description, created_at)
                 VALUES ($1, 'paid', $2, NOW())`,
                [shipment.id, `Payment confirmed via ${provider}`]
            );
        } catch (trkErr) {
            console.warn('Failed to insert tracking status (table might be missing):', trkErr.message);
        }

        // 6. Send Notifications
        // Construct shipment object expected by sendShipmentNotifications
        const notificationData = {
            trackingNumber: shipment.tracking_number,
            sender: { name: shipment.sender_name, email: shipment.sender_email },
            receiver: { name: shipment.receiver_name, email: shipment.receiver_email },
            totalPrice: Number(shipment.total_price),
            paymentMethod: updatedPaymentMethod
        };

        // Async send
        sendShipmentNotifications(notificationData).catch(err => 
            console.error('Callback Notification Error:', err)
        );

        // 7. Redirect to Tracking Page
        return res.redirect(`${process.env.APP_URL}/tracking/${trackingNumber}?success=Payment successful`);

    } catch (err) {
        console.error('Payment Callback Error:', err);
        return res.redirect(`${process.env.APP_URL}/?error=System error processing payment`);
    }
};
