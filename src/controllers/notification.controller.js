import { success, error } from '../utils/reponse.js';
import { getUserNotifications, markNotificationRead, markAllNotificationsRead } from '../utils/notification.js';

export const getNotifications = async (req, res) => {
    const userId = req.user.id;
    console.log(userId);
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const { notifications, unreadCount } = await getUserNotifications(userId, limit, offset);
        
        return success(res, 'Notifications fetched', {
            notifications,
            unreadCount,
            pagination: {
                page: Number(page),
                limit: Number(limit)
            }
        });
    } catch (err) {
        console.error('Get Notifications Error:', err);
        return error(res, 'Failed to fetch notifications', 500);
    }
};

export const markRead = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        await markNotificationRead(id, userId);
        return success(res, 'Notification marked as read');
    } catch (err) {
        console.error('Mark Read Error:', err);
        return error(res, 'Failed to mark notification as read', 500);
    }
};

export const markAllRead = async (req, res) => {
    const userId = req.user.id;

    try {
        await markAllNotificationsRead(userId);
        return success(res, 'All notifications marked as read');
    } catch (err) {
        console.error('Mark All Read Error:', err);
        return error(res, 'Failed to mark all notifications as read', 500);
    }
};
