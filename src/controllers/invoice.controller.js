import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';
import { sendInvoiceEmail } from '../utils/email.js';
import { createNotification } from '../utils/notification.js';

// Admin: Generate Invoice
export const createInvoice = async (req, res) => {
    const { shipmentId, amount, reason, dueDate } = req.body;

    if (!shipmentId || !amount || !reason) {
        return error(res, 'Shipment ID, Amount, and Reason are required', 400);
    }

    try {
        // 1. Validate Shipment & Get details
        const shipmentRes = await query(
            `SELECT s.id, s.tracking_number, s.user_id, 
                    u.email, u.first_name, u.last_name
             FROM shipments s
             JOIN users u ON s.user_id = u.id
             WHERE s.id = $1`,
            [shipmentId]
        );

        if (shipmentRes.rows.length === 0) {
            return error(res, 'Shipment not found', 404);
        }

        const shipment = shipmentRes.rows[0];
        const due = dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Default 7 days

        // 2. Create Invoice
        const invoiceRes = await query(
            `INSERT INTO invoices (shipment_id, user_id, amount, reason, status, due_date)
             VALUES ($1, $2, $3, $4, 'pending', $5)
             RETURNING id, created_at`,
            [shipment.id, shipment.user_id, amount, reason, due]
        );
        
        const invoice = invoiceRes.rows[0];

        // 3. Send Email
        sendInvoiceEmail({
            email: shipment.email,
            name: `${shipment.first_name} ${shipment.last_name}`,
            amount: Number(amount),
            reason,
            trackingNumber: shipment.tracking_number,
            invoiceId: invoice.id,
            dueDate: due
        }).catch(err => console.error('BG Email Error:', err));

        // 4. Create Notification
        createNotification(
            shipment.user_id,
            'New Invoice Generated',
            `An invoice of ₦${Number(amount).toLocaleString()} has been generated for shipment ${shipment.tracking_number}. Reason: ${reason}`,
            'invoice',
            { invoiceId: invoice.id, shipmentId: shipment.id, trackingNumber: shipment.tracking_number }
        );

        return success(res, 'Invoice generated successfully', {
            invoiceId: invoice.id,
            amount: Number(amount),
            status: 'pending'
        }, 201);

    } catch (err) {
        console.error('Create Invoice Error:', err);
        return error(res, 'Failed to generate invoice', 500);
    }
};

// Get Invoices (Admin: all/filter, User: own)
export const getInvoices = async (req, res) => {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { shipmentId, status } = req.query;

    try {
        let sql = `
            SELECT i.*, s.tracking_number, u.email as user_email
            FROM invoices i
            JOIN shipments s ON i.shipment_id = s.id
            JOIN users u ON i.user_id = u.id
        `;
        const params = [];
        let conditions = [];

        // Filter by User (if not admin, or if admin wants specific user)
        // Actually, if user, FORCE own invoices.
        if (!isAdmin) {
             conditions.push(`i.user_id = $${params.length + 1}`);
             params.push(userId);
        } else if (req.query.userId) { // Admin filtering by user
             conditions.push(`i.user_id = $${params.length + 1}`);
             params.push(req.query.userId);
        }

        if (shipmentId) {
             conditions.push(`i.shipment_id = $${params.length + 1}`);
             params.push(shipmentId);
        }

        if (status) {
             conditions.push(`i.status = $${params.length + 1}`);
             params.push(status);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY i.created_at DESC';

        const result = await query(sql, params);
        
        return success(res, 'Invoices fetched', result.rows);
    } catch (err) {
        console.error('Get Invoices Error:', err);
        return error(res, 'Failed to fetch invoices', 500);
    }
};
