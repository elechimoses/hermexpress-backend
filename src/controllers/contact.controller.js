import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';
import { sendAdminContactNotification } from '../utils/email.js';

export const submitContactForm = async (req, res) => {
    const { first_name, last_name, email, message } = req.body;

    if (!first_name || !last_name || !email || !message) {
        return error(res, 'All fields are required', 400);
    }

    try {
        const result = await query(
            'INSERT INTO contact_messages (first_name, last_name, email, message) VALUES ($1, $2, $3, $4) RETURNING *',
            [first_name, last_name, email, message]
        );

        // Send email notification to admin asynchronously
        sendAdminContactNotification({ first_name, last_name, email, message }).catch(err => 
            console.error('Contact email alert error:', err)
        );

        return success(res, 'Message sent successfully. We will get back to you soon.', result.rows[0], 201);
    } catch (err) {
        console.error('Contact form error:', err);
        return error(res, 'Failed to send message. Please try again later.', 500);
    }
};
