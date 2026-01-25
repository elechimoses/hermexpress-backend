import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';
import { initializePayment, verifyPayment } from '../services/payment.service.js';
import { sendShipmentNotifications, sendWalletFundingSuccessEmail, sendWalletFundingFailureEmail } from '../utils/email.js';
import { createNotification } from '../utils/notification.js';


const AMOUNT_DIVISOR = {
  paystack: 100,
  korapay: 1,
};

const TRANSACTION_TYPES = {
  WALLET_FUNDING: 'wallet_funding',
};

const normalizeAmount = (amount, provider) => Number(amount) / (AMOUNT_DIVISOR[provider] || 100);

// Public: Get Active Methods
export const getPaymentMethods = async (req, res) => {
    try {
        const result = await query(
            'SELECT id, provider, name, description, config, image_url FROM payment_methods WHERE is_active = TRUE'
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
    
    // Handle Image Upload
    let imageUrl = null;
    if (req.file) {
         imageUrl = req.file.path.replace(/\\/g, "/");
    }

    try {
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

        if (imageUrl) {
            updateQuery += `, image_url = $${paramIndex}`;
            params.push(imageUrl);
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

    // Handle Image Upload
    let imageUrl = null;
    if (req.file) {
            imageUrl = req.file.path.replace(/\\/g, "/");
    }

    if (!provider || !name) {
        return error(res, 'Provider and Name are required', 400);
    }

    try {
        const result = await query(
            `INSERT INTO payment_methods (provider, name, description, is_active, config, image_url)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [provider, name, description, is_active !== undefined ? is_active : false, config || {}, imageUrl]
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

        if (shipment.status === 'paid') {
            return error(res,'Shipment has already been paid', 409 );
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


export const handlePaymentCallback = async (req, res) => {
  const { provider } = req.params;
  const { reference, trxref } = req.query;

  const paymentRef = reference || trxref;

  if (!paymentRef) {
    return error(res, 'No payment reference provided', 400);
  }

  console.log(`[${provider.toUpperCase()}] Processing callback for ref: ${paymentRef}`);

  try {
    // 1. Verify payment
    const verification = await verifyPayment(provider, paymentRef);
    const data = verification.data;
    const metadata = data?.metadata || {};
    const transactionType = metadata?.transaction_type;

    // If verification failed completely (no data) or it's not wallet funding, strictly enforce success
    if (!verification?.success && (!data || transactionType !== TRANSACTION_TYPES.WALLET_FUNDING)) {
      return error(res, 'Payment verification failed', 400);
    }

    // Early return for wallet funding (independent flow)
    if (transactionType === TRANSACTION_TYPES.WALLET_FUNDING) {
      if (verification.success) {
          return await handleWalletFunding(res, paymentRef, provider, data, metadata);
      } else {
          return await handleWalletFundingFailure(res, paymentRef, provider, data, metadata);
      }
    }

    // 2. Shipment / order payment flow (default)
    return await handleShipmentPayment(res, paymentRef, provider, data, metadata);

  } catch (err) {
    console.error(`[${provider}] Payment callback failed:`, err);
    return error(res, 'Internal error processing payment callback', 500);
  }
};

/**
 * Handle wallet top-up logic
 */
async function handleWalletFunding(res, paymentRef, provider, verificationData, metadata) {
  const walletId = metadata.wallet_id;
  if (!walletId) {
    return error(res, 'Missing wallet_id in metadata', 400);
  }

  const amount = normalizeAmount(verificationData.amount, provider);

  try {
    await query('BEGIN');

    // Idempotency check
    const existing = await query(
      'SELECT 1 FROM wallet_transactions WHERE reference = $1 AND status = $2',
      [paymentRef, 'success']
    );

    if (existing.rows.length > 0) {
      await query('ROLLBACK');
      return error(res, 'Payment already processed', 409); // 409 Conflict is more appropriate
    }

    // Get current balance for transaction record
    const walletBefore = await query(
      'SELECT balance FROM wallets WHERE id = $1 FOR UPDATE',
      [walletId]
    );

    if (walletBefore.rows.length === 0) {
      await query('ROLLBACK');
      return error(res, 'Wallet not found', 404);
    }

    const balanceBefore = Number(walletBefore.rows[0].balance);

    // Credit wallet
    await query(
      'UPDATE wallets SET balance = balance + $1, updated_at = NOW() WHERE id = $2',
      [amount, walletId]
    );

    // Record transaction
    await query(
      `INSERT INTO wallet_transactions (
        wallet_id, type, amount, balance_before, balance_after,
        reference, description, status, meta_data, created_at
      ) VALUES ($1, 'credit', $2, $3, $4, $5, $6, 'success', $7, NOW())`,
      [
        walletId,
        amount,
        balanceBefore,
        balanceBefore + amount,
        paymentRef,
        `Wallet funded via ${provider}`,
        JSON.stringify(metadata),
      ]
    );

    await query('COMMIT');

    // Send Success Email
    // Try to get email from data > metadata > query user
    let userEmail = verificationData.customer?.email;
    let userName = 'User';
    
    // If we only have walletId, we might need to fetch user details if email is missing
    if (!userEmail) {
         try {
             // We can join wallets and users
             const uInfo = await query('SELECT u.email, u.first_name FROM users u JOIN wallets w ON u.id = w.user_id WHERE w.id = $1', [walletId]);
             if (uInfo.rows.length > 0) {
                 userEmail = uInfo.rows[0].email;
                 userName = uInfo.rows[0].first_name;
             }
         } catch(e) { console.error('Failed to fetch user for email', e); }
    }

    if (userEmail) {
        sendWalletFundingSuccessEmail({
            email: userEmail,
            name: userName,
            amount: amount,
            newBalance: balanceBefore + amount,
            transactionReference: paymentRef
        });
    }

    createNotification(
        metadata.user_id, 
        'Wallet Funded',
        `Your wallet has been funded with ₦${amount.toLocaleString()}. New Balance: ₦${(balanceBefore + amount).toLocaleString()}`,
        'funding',
        { walletId, amount, reference: paymentRef }
    );
    // Correction: In handleWalletFunding, I have 'metadata' which contains 'user_id'.
    // Let's use metadata.user_id.

    return success(res, 'Wallet funded successfully', { amount, walletId });

  } catch (err) {
    await query('ROLLBACK');
    console.error('Wallet funding failed:', err);
    return error(res, 'Failed to credit wallet', 500);
  }
}

/**
 * Handle wallet funding failure
 */
async function handleWalletFundingFailure(res, paymentRef, provider, verificationData, metadata) {
   const walletId = metadata.wallet_id;
   const amount = normalizeAmount(verificationData.amount || 0, provider);
   
    // Try to get email
    let userEmail = verificationData.customer?.email;
    let userName = 'User';

    if (!userEmail && walletId) {
         try {
             const uInfo = await query('SELECT u.email, u.first_name FROM users u JOIN wallets w ON u.id = w.user_id WHERE w.id = $1', [walletId]);
             if (uInfo.rows.length > 0) {
                 userEmail = uInfo.rows[0].email;
                 userName = uInfo.rows[0].first_name;
             }
         } catch(e) { console.error('Failed to fetch user for failure email', e); }
    }

    if (userEmail) {
        sendWalletFundingFailureEmail({
            email: userEmail,
            name: userName,
            amount: amount,
            transactionReference: paymentRef
        });
    }

    if (metadata.user_id) {
         createNotification(
            metadata.user_id,
            'Wallet Funding Failed',
            `Funding attempt of ₦${amount.toLocaleString()} failed. Ref: ${paymentRef}`,
            'funding',
            { walletId, amount, reference: paymentRef, status: 'failed' }
        );
    }
    
    // We still return error response to the caller (likely a webhook or frontend redirect)
    return error(res, 'Payment failed or declined', 400);
}

/**
 * Handle shipment/order payment logic
 */
async function handleShipmentPayment(res, paymentRef, provider, verificationData, metadata) {
  const trackingNumber = metadata.tracking_number;

  if (!trackingNumber) {
    return error(res, 'Missing tracking_number in payment metadata', 400);
  }

  const shipmentRes = await query(
    `SELECT s.*, 
            sa.name AS sender_name,  sa.email AS sender_email,
            ra.name AS receiver_name, ra.email AS receiver_email
     FROM shipments s
     LEFT JOIN shipment_addresses sa ON s.id = sa.shipment_id AND sa.type = 'sender'
     LEFT JOIN shipment_addresses ra ON s.id = ra.shipment_id AND ra.type = 'receiver'
     WHERE s.tracking_number = $1`,
    [trackingNumber]
  );

  if (shipmentRes.rows.length === 0) {
    return error(res, 'Shipment not found', 404);
  }

  const shipment = shipmentRes.rows[0];

  if (shipment.status === 'paid') {
    return error(res, 'Shipment payment already confirmed', 409);
  }

  // Prepare updated payment method object
  const updatedPaymentMethod = {
    ...shipment.payment_method,
    provider,
    transactionReference: paymentRef,
    verifiedAt: new Date().toISOString(),
    amount: verificationData.amount,
  };

  try {
    await query('BEGIN');

    // Update shipment
    await query(
      `UPDATE shipments 
       SET status = 'paid', 
           payment_method = $1,
           updated_at = NOW()
       WHERE id = $2`,
      [updatedPaymentMethod, shipment.id]
    );

    // Record tracking history
    // await query(
    //   `INSERT INTO tracking_statuses (shipment_id, status, description, created_at)
    //    VALUES ($1, 'paid', $2, NOW())`,
    //   [shipment.id, `Payment confirmed via ${provider}`]
    // );

    await query('COMMIT');

    // Fire and forget notifications
    const notificationData = {
      trackingNumber: shipment.tracking_number,
      sender: { name: shipment.sender_name, email: shipment.sender_email },
      receiver: { name: shipment.receiver_name, email: shipment.receiver_email },
      totalPrice: Number(shipment.total_price),
      paymentMethod: updatedPaymentMethod,
    };

    sendShipmentNotifications(notificationData).catch(err =>
      console.error('Notification dispatch failed:', err)
    );

    createNotification(
        shipment.user_id,
        'Shipment Paid',
        `Shipment ${shipment.tracking_number} has been paid successfully.`,
        'shipment',
        { shipmentId: shipment.id, trackingNumber: shipment.tracking_number, amount: verificationData.amount }
    );

    return success(res, 'Shipment payment confirmed', {
      trackingNumber: shipment.tracking_number,
      status: 'paid',
    });

  } catch (err) {
    await query('ROLLBACK');
    console.error('Shipment payment update failed:', err);
    return error(res, 'Failed to update shipment status', 500);
  }
}
