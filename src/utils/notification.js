import { query } from '../db/index.js';

/**
 * Create a new notification for a user
 * @param {number} userId 
 * @param {string} title 
 * @param {string} body 
 * @param {string} type - 'invoice', 'funding', 'shipment', 'system'
 * @param {object} metadata - Extra data like IDs
 */
export const createNotification = async (userId, title, body, type, metadata = {}) => {
    try {
        await query(
            `INSERT INTO notifications (user_id, title, body, type, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [userId, title, body, type, metadata]
        );
    } catch (err) {
        console.error('Create Notification Error:', err);
        // Don't throw, just log. Notifications shouldn't break main flow.
    }
};

/**
 * Get notifications for a user
 * @param {number} userId 
 * @param {number} limit 
 * @param {number} offset 
 */
export const getUserNotifications = async (userId, limit = 20, offset = 0) => {
    const result = await query(
        `SELECT * FROM notifications 
         WHERE user_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
    );
    
    // Get unread count
    const countRes = await query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND status = 'unread'`,
        [userId]
    );

    return {
        notifications: result.rows,
        unreadCount: Number(countRes.rows[0].count)
    };
};

/**
 * Mark notification as read
 * @param {number} id 
 * @param {number} userId 
 */
export const markNotificationRead = async (id, userId) => {
    await query(
        `UPDATE notifications SET status = 'read', updated_at = NOW() 
         WHERE id = $1 AND user_id = $2`,
        [id, userId]
    );
};

/**
 * Mark all notifications as read for a user
 * @param {number} userId 
 */
export const markAllNotificationsRead = async (userId) => {
    await query(
        `UPDATE notifications SET status = 'read', updated_at = NOW() 
         WHERE user_id = $1 AND status = 'unread'`,
        [userId]
    );
};
