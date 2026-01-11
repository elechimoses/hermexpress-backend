import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

export const saveAddress = async (req, res) => {
    const { 
        type, name, email, phone, 
        country, state, city, address, postal_code, 
        is_default 
    } = req.body;

    // Validation
    if (!type || !name || !phone || !country || !state || !city || !address) {
        return error(res, 'Missing required address fields', 400);
    }

    if (!['sender', 'receiver'].includes(type)) {
        return error(res, 'Invalid address type (sender/receiver)', 400);
    }

    try {
        const userId = req.user.id;

        // If setting default, unset others of same type
        if (is_default) {
            await query(
                'UPDATE addresses SET is_default = FALSE WHERE user_id = $1 AND type = $2',
                [userId, type]
            );
        }

        const result = await query(
            `INSERT INTO addresses (
                user_id, type, name, email, phone, 
                country, state, city, address, postal_code, is_default
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
            RETURNING *`,
            [userId, type, name, email || null, phone, country, state, city, address, postal_code || null, is_default || false]
        );

        return success(res, 'Address saved successfully', result.rows[0], 201);

    } catch (err) {
        console.error('Save Address Error:', err);
        return error(res, 'Failed to save address', 500);
    }
};

export const getAddresses = async (req, res) => {
    try {
        const userId = req.user.id;
        const { type } = req.query; // Optional filter by type

        let result;
        if (type) {
             result = await query('SELECT * FROM addresses WHERE user_id = $1 AND type = $2 ORDER BY is_default DESC, created_at DESC', [userId, type]);
        } else {
             result = await query('SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC', [userId]);
        }

        return success(res, 'Addresses fetched successfully', result.rows);

    } catch (err) {
        console.error('Get Addresses Error:', err);
        return error(res, 'Failed to fetch addresses', 500);
    }
};
