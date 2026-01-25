import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';
import { initializePayment } from '../services/payment.service.js';

// Get Wallet Balance & Active State
export const getWallet = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await query(
            'SELECT id, balance, currency, is_active FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        let wallet;
        if (result.rows.length === 0) {
            // Auto-create wallet if not exists (lazy creation)
            const newRes = await query(
                'INSERT INTO wallets (user_id) VALUES ($1) RETURNING id, balance, currency, is_active',
                [userId]
            );
            wallet = newRes.rows[0];
        } else {
            wallet = result.rows[0];
        }

        return success(res, 'Wallet details fetched', { ...wallet, balance: Number(wallet.balance) });
    } catch (err) {
        console.error('Info Wallet Error:', err);
        return error(res, 'Failed to fetch wallet info', 500);
    }
};

// Get Wallet Transactions
export const getTransactions = async (req, res) => {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const walletRes = await query('SELECT id FROM wallets WHERE user_id = $1', [userId]);
        if (walletRes.rows.length === 0) return success(res, 'No transactions found', []);

        const walletId = walletRes.rows[0].id;

        const txRes = await query(
            `SELECT * FROM wallet_transactions 
             WHERE wallet_id = $1 
             ORDER BY created_at DESC 
             LIMIT $2 OFFSET $3`,
            [walletId, limit, offset]
        );
        
        // Count total for pagination
        const countRes = await query(
            'SELECT COUNT(*) FROM wallet_transactions WHERE wallet_id = $1',
            [walletId]
        );

        return success(res, 'Transactions fetched', {
            transactions: txRes.rows.map(t => ({...t, amount: Number(t.amount), balance_before: Number(t.balance_before), balance_after: Number(t.balance_after)})),
            pagination: {
                total: Number(countRes.rows[0].count),
                page: Number(page),
                limit: Number(limit)
            }
        });

    } catch (err) {
        console.error('Get Tx Error:', err);
        return error(res, 'Failed to fetch transactions', 500);
    }
};

// Fund Wallet (User initiates)
export const fundWallet = async (req, res) => {
    const userId = req.user.id;
    const { amount, paymentMethodId } = req.body;

    if (!amount || amount <= 0) return error(res, 'Invalid amount', 400);
    if (!paymentMethodId) return error(res, 'Payment method is required', 400);

    try {
        // 1. Get Wallet (Ensure exists)
        const walletRes = await query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
        let walletId;
        if (walletRes.rows.length === 0) {
             const newW = await query('INSERT INTO wallets (user_id) VALUES ($1) RETURNING id', [userId]);
             walletId = newW.rows[0].id;
        } else {
             if (!walletRes.rows[0].is_active) return error(res, 'Wallet is disabled', 403);
             walletId = walletRes.rows[0].id;
        }

        // 2. Get Payment Method info
        const methodRes = await query('SELECT * FROM payment_methods WHERE id = $1', [paymentMethodId]);
        if (methodRes.rows.length === 0) return error(res, 'Invalid payment method', 400);
        const method = methodRes.rows[0];

        const result = await initializePayment({
            provider: method.provider,
            config: method.config || {},
            amount: Number(amount),
            email: req.user.email,
            name: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || 'Valued Customer',
            trackingNumber: `WREF-${Date.now()}`, 
            shipmentId: 'WREF',
            metadata: {
                transaction_type: 'wallet_funding',
                user_id: userId,
                wallet_id: walletId
            }
        });

        return success(res, 'Wallet funding initialized', result);

    } catch (err) {
        console.error('Fund Wallet Error:', err);
        return error(res, err.message || 'Failed to initialize funding', 500);
    }
};

// Admin: Credit/Debit/Toggle User Wallet
export const adminUpdateWallet = async (req, res) => {
    const { userId, action, amount, description, is_active } = req.body;
    // action: 'credit', 'debit', 'toggle'

    if (!userId) return error(res, 'User ID is required', 400);

    try {
        await query('BEGIN');

        let walletRes = await query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
        let wallet;
        if (walletRes.rows.length === 0) {
             const newW = await query('INSERT INTO wallets (user_id) VALUES ($1) RETURNING *', [userId]);
             wallet = newW.rows[0];
        } else {
             wallet = walletRes.rows[0];
        }

        // Toggle Active
        if (action === 'toggle' && is_active !== undefined) {
            await query('UPDATE wallets SET is_active = $1, updated_at = NOW() WHERE id = $2', [is_active, wallet.id]);
            await query('COMMIT');
            return success(res, `Wallet ${is_active ? 'enabled' : 'disabled'} successfully`);
        }

        // Credit/Debit
        if (action === 'credit' || action === 'debit') {
            if (!amount || amount <= 0) {
                await query('ROLLBACK');
                return error(res, 'Invalid amount', 400);
            }

            const currentBalance = Number(wallet.balance);
            let newBalance = currentBalance;
            const floatAmount = Number(amount);

            if (action === 'credit') {
                newBalance += floatAmount;
            } else {
                if (currentBalance < floatAmount) {
                     await query('ROLLBACK');
                     return error(res, 'Insufficient wallet balance', 400);
                }
                newBalance -= floatAmount;
            }

            // Update Wallet
            await query('UPDATE wallets SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, wallet.id]);

            // Create Transaction Record
            await query(
                `INSERT INTO wallet_transactions 
                 (wallet_id, type, amount, balance_before, balance_after, reference, description, status, meta_data)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, 'success', $8)`,
                [
                    wallet.id, 
                    action, 
                    floatAmount, 
                    currentBalance, 
                    newBalance, 
                    `ADMIN-${Date.now()}`, 
                    description || `Admin ${action}`, 
                    JSON.stringify({ admin_id: req.user.id })
                ]
            );

            await query('COMMIT');
            return success(res, `Wallet ${action}ed successfully`, { newBalance });
        }

        await query('ROLLBACK');
        return error(res, 'Invalid action', 400);

    } catch (err) {
        await query('ROLLBACK');
        console.error('Admin Wallet Update Error:', err);
        return error(res, 'Failed to update wallet', 500);
    }
};
