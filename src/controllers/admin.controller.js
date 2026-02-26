import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

// --- Countries ---

export const createCountry = async (req, res) => {
    const { name, code, can_import_from, can_export_to, is_active, region_id } = req.body;
    try {
        const result = await query(
            `INSERT INTO countries (name, code, can_import_from, can_export_to, is_active, region_id)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [name, code, can_import_from || false, can_export_to || false, is_active || true, region_id || null]
        );
        return success(res, 'Country created', result.rows[0], 201);
    } catch (err) {
        console.error('Create Country Error:', err);
        return error(res, 'Failed to create country', 500);
    }
};

export const updateCountry = async (req, res) => {
    const { id } = req.params;
    const { name, code, can_import_from, can_export_to, is_active, region_id } = req.body;
    try {
        const result = await query(
            `UPDATE countries SET 
       name = COALESCE($1, name),
       code = COALESCE($2, code),
       can_import_from = COALESCE($3, can_import_from),
       can_export_to = COALESCE($4, can_export_to),
       is_active = COALESCE($5, is_active),
       region_id = COALESCE($6, region_id)
       WHERE id = $7 RETURNING *`,
            [name, code, can_import_from, can_export_to, is_active, region_id, id]
        );
        if (result.rows.length === 0) return error(res, 'Country not found', 404);
        return success(res, 'Country updated', result.rows[0]);
    } catch (err) {
        console.error('Update Country Error:', err);
        return error(res, 'Failed to update country', 500);
    }
};

export const getCountries = async (req, res) => {
    try {
        const result = await query(`
      SELECT c.*, r.name as region_name 
      FROM countries c 
      LEFT JOIN regions r ON c.region_id = r.id 
      ORDER BY c.name ASC
    `);
        return success(res, 'Countries fetched', result.rows);
    } catch (err) {
        console.error('Get Countries Error:', err);
        return error(res, 'Failed to fetch countries', 500);
    }
};

// --- Regions ---

export const createRegion = async (req, res) => {
    const { name } = req.body;
    try {
        const result = await query(
            'INSERT INTO regions (name) VALUES ($1) RETURNING *',
            [name]
        );
        return success(res, 'Region created', result.rows[0], 201);
    } catch (err) {
        console.error('Create Region Error:', err);
        return error(res, 'Failed to create region', 500);
    }
};

export const getRegions = async (req, res) => {
    try {
        const result = await query('SELECT * FROM regions ORDER BY name ASC');
        return success(res, 'Regions fetched', result.rows);
    } catch (err) {
        console.error('Get Regions Error:', err);
        return error(res, 'Failed to fetch regions', 500);
    }
};

export const updateRegion = async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    try {
        const result = await query(
            'UPDATE regions SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [name, id]
        );
        if (result.rows.length === 0) return error(res, 'Region not found', 404);
        return success(res, 'Region updated', result.rows[0]);
    } catch (err) {
        console.error('Update Region Error:', err);
        return error(res, 'Failed to update region', 500);
    }
};

export const deleteRegion = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM regions WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) return error(res, 'Region not found', 404);
        return success(res, 'Region deleted', null);
    } catch (err) {
        console.error('Delete Region Error:', err);
        return error(res, 'Failed to delete region', 500);
    }
};
// --- Cities ---

export const createCity = async (req, res) => {
    const { country_id, name, state, is_active } = req.body;
    try {
        const result = await query(
            `INSERT INTO cities (country_id, name, state, is_active)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [country_id, name, state, is_active || true]
        );
        return success(res, 'City created', result.rows[0], 201);
    } catch (err) {
        return error(res, 'Failed to create city', 500);
    }
};

export const updateCity = async (req, res) => {
    const { id } = req.params;
    const { name, state, is_active } = req.body;
    try {
        const result = await query(
            `UPDATE cities SET 
       name = COALESCE($1, name),
       state = COALESCE($2, state),
       is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
            [name, state, is_active, id]
        );
        if (result.rows.length === 0) return error(res, 'City not found', 404);
        return success(res, 'City updated', result.rows[0]);
    } catch (err) {
        return error(res, 'Failed to update city', 500);
    }
};

export const getCities = async (req, res) => {
    const { country_id } = req.query;
    try {
        let queryStr = 'SELECT cities.*, countries.name as country_name FROM cities JOIN countries ON cities.country_id = countries.id';
        const params = [];
        if (country_id) {
            queryStr += ' WHERE country_id = $1';
            params.push(country_id);
        }
        queryStr += ' ORDER BY countries.name ASC, cities.name ASC';

        const result = await query(queryStr, params);
        return success(res, 'Cities fetched', result.rows);
    } catch (err) {
        return error(res, 'Failed to fetch cities', 500);
    }
};
// Helper to fetch standardized option context (Full nested structure)
const getStandardizedOptionResponse = async (optionId, service_type = null) => {
    let sql = `
        SELECT 
            s.id, s.name, s.description, s.min_days, s.max_days, s.is_active, s.created_at, s.updated_at,
            rr.service_type,
            JSON_AGG(
                JSON_BUILD_OBJECT(
                    'region_id', rr.region_id,
                    'region_name', r.name,
                    'rates', rr.rates
                ) ORDER BY r.name ASC
            ) as rates
        FROM shipment_options s
        JOIN (
            SELECT 
                shipment_option_id, region_id, service_type,
                JSON_AGG(JSON_BUILD_OBJECT('weight_kg', weight_kg, 'amount', amount) ORDER BY weight_kg ASC) as rates
            FROM shipment_option_region_rates
            GROUP BY shipment_option_id, region_id, service_type
        ) rr ON s.id = rr.shipment_option_id
        JOIN regions r ON rr.region_id = r.id
        WHERE s.id = $1
    `;
    const params = [optionId];

    if (service_type) {
        params.push(service_type);
        sql += ` AND rr.service_type = $2`;
    }

    sql += ` GROUP BY s.id, rr.service_type`;

    // If specific service_type is requested, return that single block
    const result = await query(sql, params);
    return service_type ? (result.rows[0] || null) : result.rows;
};

// --- Options ---
export const createOption = async (req, res) => {
    const { name, description, min_days, max_days, is_active, service_type, rates } = req.body;

    if (!name || !service_type || !rates || !Array.isArray(rates)) {
        return error(res, 'Name, service_type, and rates (array) are required', 400);
    }

    try {
        await query('BEGIN');

        // 1. Get or Create Shipment Option
        let optionRes = await query('SELECT id FROM shipment_options WHERE name = $1', [name]);
        let optionId;

        if (optionRes.rows.length > 0) {
            optionId = optionRes.rows[0].id;
            await query(
                `UPDATE shipment_options SET
                 description = COALESCE($1, description),
                 min_days = COALESCE($2, min_days),
                 max_days = COALESCE($3, max_days),
                 is_active = COALESCE($4, is_active),
                 updated_at = NOW()
                 WHERE id = $5`,
                [description, min_days, max_days, is_active, optionId]
            );
        } else {
            const newOption = await query(
                `INSERT INTO shipment_options (name, description, min_days, max_days, is_active) 
                 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [name, description, min_days, max_days, is_active !== undefined ? is_active : true]
            );
            optionId = newOption.rows[0].id;
        }

        // 2. Process Multi-region rates
        for (const regionBlock of rates) {
            const region_id = regionBlock.region_id;
            const regionRates = regionBlock.rates || regionBlock.data || [];

            if (!region_id) continue;

            await query(
                'DELETE FROM shipment_option_region_rates WHERE shipment_option_id = $1 AND region_id = $2 AND service_type = $3',
                [optionId, region_id, service_type]
            );

            for (const rate of regionRates) {
                await query(
                    `INSERT INTO shipment_option_region_rates (shipment_option_id, region_id, weight_kg, amount, service_type)
                     VALUES ($1, $2, $3, $4, $5)`,
                    [optionId, region_id, rate.weight_kg, rate.amount, service_type]
                );
            }
        }

        await query('COMMIT');

        const response = await getStandardizedOptionResponse(optionId, service_type);
        return success(res, 'Option processed successfully', response, 201);
    } catch (err) {
        await query('ROLLBACK');
        console.error('Create Option Error:', err);
        return error(res, 'Failed to process option and rates', 500);
    }
};

export const updateOption = async (req, res) => {
    const { id } = req.params; // option_id
    const { name, description, min_days, max_days, is_active, service_type, rates } = req.body;

    try {
        await query('BEGIN');

        // 1. Update Option Metadata
        const updatedOptionRes = await query(
            `UPDATE shipment_options SET
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             min_days = COALESCE($3, min_days),
             max_days = COALESCE($4, max_days),
             is_active = COALESCE($5, is_active),
             updated_at = NOW()
             WHERE id = $6 RETURNING *`,
            [name, description, min_days, max_days, is_active, id]
        );

        if (updatedOptionRes.rows.length === 0) {
            await query('ROLLBACK');
            return error(res, 'Option not found', 404);
        }

        // 2. Update Rates if provided
        if (rates && Array.isArray(rates) && service_type) {
            for (const regionBlock of rates) {
                const region_id = regionBlock.region_id;
                const regionRates = regionBlock.rates || regionBlock.data || [];

                if (!region_id) continue;

                await query(
                    'DELETE FROM shipment_option_region_rates WHERE shipment_option_id = $1 AND region_id = $2 AND service_type = $3',
                    [id, region_id, service_type]
                );

                for (const rate of regionRates) {
                    await query(
                        `INSERT INTO shipment_option_region_rates (shipment_option_id, region_id, weight_kg, amount, service_type)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [id, region_id, rate.weight_kg, rate.amount, service_type]
                    );
                }
            }
        }

        await query('COMMIT');

        const response = await getStandardizedOptionResponse(id, service_type);
        return success(res, 'Option updated successfully', response);
    } catch (err) {
        await query('ROLLBACK');
        console.error('Update Option Error:', err);
        return error(res, 'Failed to update option', 500);
    }
};

export const getOptions = async (req, res) => {
    const { region_id, service_type } = req.query;
    try {
        let sql = `
            SELECT 
                s.id, s.name, s.description, s.min_days, s.max_days, s.is_active, s.created_at, s.updated_at,
                rr.service_type,
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'region_id', rr.region_id,
                        'region_name', r.name,
                        'rates', rr.rates
                    ) ORDER BY r.name ASC
                ) as rates
            FROM shipment_options s
            JOIN (
                SELECT 
                    shipment_option_id, region_id, service_type,
                    JSON_AGG(JSON_BUILD_OBJECT('weight_kg', weight_kg, 'amount', weight_kg) ORDER BY weight_kg ASC) as rates
                FROM shipment_option_region_rates
                GROUP BY shipment_option_id, region_id, service_type
            ) rr ON s.id = rr.shipment_option_id
            JOIN regions r ON rr.region_id = r.id
            WHERE s.is_active = true
        `;
        const params = [];

        if (region_id) {
            params.push(region_id);
            sql += ` AND r.id = $${params.length}`;
        }
        if (service_type) {
            params.push(service_type);
            sql += ` AND rr.service_type = $${params.length}`;
        }

        sql += `
            GROUP BY s.id, rr.service_type
            ORDER BY s.name ASC
        `;

        const result = await query(sql, params);

        let finalRows = result.rows;
        if (region_id) {
            finalRows = result.rows.map(row => ({
                ...row,
                rates: row.rates.filter(r => r.region_id == region_id)
            }));
        }

        return success(res, 'Options fetched', finalRows);
    } catch (err) {
        console.error('Fetch Options Error:', err);
        return error(res, 'Failed to fetch options', 500);
    }
};

export const getRegionRates = async (req, res) => {
    try {
        const sql = `
            SELECT 
                r.id,
                r.name as region_name,
                COALESCE(
                    (SELECT JSON_AGG(c.name ORDER BY c.name) FROM countries c WHERE c.region_id = r.id),
                    '[]'::json
                ) as countries,
                COALESCE(
                    JSON_AGG(
                        JSON_BUILD_OBJECT(
                            'option_name', s.name,
                            'service_type', rr.service_type,
                            'rates', rr.rates
                        ) ORDER BY s.name ASC, rr.service_type ASC
                    ) FILTER (WHERE s.id IS NOT NULL),
                    '[]'::json
                ) as options
            FROM regions r
            LEFT JOIN (
                SELECT 
                    shipment_option_id, region_id, service_type,
                    JSON_AGG(JSON_BUILD_OBJECT('weight_kg', weight_kg, 'amount', amount) ORDER BY weight_kg ASC) as rates
                FROM shipment_option_region_rates
                GROUP BY shipment_option_id, region_id, service_type
            ) rr ON r.id = rr.region_id
            LEFT JOIN shipment_options s ON rr.shipment_option_id = s.id
            GROUP BY r.id, r.name
            ORDER BY r.name ASC
        `;

        const result = await query(sql);
        return success(res, 'Region rates fetched successfully', result.rows);
    } catch (err) {
        console.error('Get Region Rates Error:', err);
        return error(res, 'Failed to fetch region rates', 500);
    }
};


// --- Users ---

export const getUsers = async (req, res) => {
    try {
        const queryStr = `
            SELECT 
                u.id, u.first_name, u.last_name, u.email, u.phone, u.account_type, 
                u.is_verified, u.is_profile_complete, u.avatar_url, u.created_at,
                w.balance as wallet_balance,
                t.name as tier_name, t.discount_percentage as tier_discount,
                (SELECT COUNT(*) FROM shipments s WHERE s.user_id = u.id) as shipment_count
            FROM users u
            LEFT JOIN wallets w ON u.id = w.user_id
            LEFT JOIN user_tiers t ON u.tier_id = t.id
            WHERE u.account_type != 'admin'
            ORDER BY u.created_at DESC
        `;
        const result = await query(queryStr);
        return success(res, 'Users fetched', result.rows);
    } catch (err) {
        console.error('Get Users Error:', err);
        return error(res, 'Failed to fetch users', 500);
    }
};

export const getUserProfile = async (req, res) => {
    const { id } = req.params;
    try {
        // Fetch User + Basic Info
        const userRes = await query(
            `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.country_dial_code, 
                    u.account_type, u.is_verified, u.is_profile_complete, u.avatar_url,
                    u.tier_id, t.name as tier_name, t.discount_percentage as tier_discount
             FROM users u
             LEFT JOIN user_tiers t ON u.tier_id = t.id
             WHERE u.id = $1`,
            [id]
        );

        if (userRes.rows.length === 0) return error(res, 'User not found', 404);
        const user = userRes.rows[0];

        let profileData = {};

        if (user.is_profile_complete) {
            const isBusiness = user.account_type?.toLowerCase() === 'business';
            if (isBusiness) {
                const bizRes = await query('SELECT * FROM business_profiles WHERE user_id = $1', [id]);
                if (bizRes.rows.length > 0) profileData = bizRes.rows[0];
            } else {
                const personalRes = await query('SELECT * FROM user_profiles WHERE user_id = $1', [id]);
                if (personalRes.rows.length > 0) profileData = personalRes.rows[0];
            }
        }

        // Also get wallet and active shipments
        const walletRes = await query('SELECT balance, currency, is_active FROM wallets WHERE user_id = $1', [id]);
        const shipmentCountRes = await query('SELECT COUNT(*) FROM shipments WHERE user_id = $1', [id]);

        return success(res, 'User profile fetched', {
            user,
            profile: profileData,
            wallet: walletRes.rows[0] || { balance: 0, currency: 'NGN', is_active: false },
            shipment_count: parseInt(shipmentCountRes.rows[0].count)
        });

    } catch (err) {
        console.error('Get User Profile Error:', err);
        return error(res, 'Failed to fetch user profile', 500);
    }
};


// Contact Messages
export const getContactMessages = async (req, res) => {
    try {
        const result = await query('SELECT * FROM contact_messages ORDER BY created_at DESC');
        return success(res, 'Contact messages fetched successfully', result.rows);
    } catch (err) {

        return error(res, 'Failed to fetch contact messages', 500);
    }
};

export const markContactMessageAsRead = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // 'read', 'unread', 'replied'
    try {
        const result = await query(
            'UPDATE contact_messages SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [status || 'read', id]
        );
        if (result.rows.length === 0) return error(res, 'Message not found', 404);
        return success(res, 'Message status updated', result.rows[0]);
    } catch (err) {

        return error(res, 'Failed to update message status', 500);
    }
};


// Settings
export const getSettings = async (req, res) => {
    try {
        const result = await query('SELECT * FROM settings ORDER BY key ASC');
        return success(res, 'Settings fetched successfully', result.rows);
    } catch (err) {

        return error(res, 'Failed to fetch settings', 500);
    }
};

export const updateSetting = async (req, res) => {
    const { key, value } = req.body;
    if (!key || value === undefined) return error(res, 'Key and value are required', 400);

    try {
        const result = await query(
            'UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *',
            [value, key]
        );
        if (result.rows.length === 0) return error(res, 'Setting not found', 404);
        return success(res, 'Setting updated successfully', result.rows[0]);
    } catch (err) {

        return error(res, 'Failed to update setting', 500);
    }
};

// Tier Management
export const getTiers = async (req, res) => {
    try {
        const result = await query('SELECT * FROM user_tiers ORDER BY level ASC');
        return success(res, 'Tiers fetched successfully', result.rows);
    } catch (err) {

        return error(res, 'Failed to fetch tiers', 500);
    }
};

export const createTier = async (req, res) => {
    const { name, level, min_shipments, discount_percentage } = req.body;
    try {
        const result = await query(
            'INSERT INTO user_tiers (name, level, min_shipments, discount_percentage) VALUES ($1, $2, $3, $4) RETURNING *',
            [name, level, min_shipments, discount_percentage]
        );
        return success(res, 'Tier created successfully', result.rows[0], 201);
    } catch (err) {

        return error(res, 'Failed to create tier', 500);
    }
};

export const updateTier = async (req, res) => {
    const { id } = req.params;
    const { name, level, min_shipments, discount_percentage, is_active } = req.body;
    try {
        const result = await query(
            'UPDATE user_tiers SET name = $1, level = $2, min_shipments = $3, discount_percentage = $4, is_active = $5, updated_at = NOW() WHERE id = $6 RETURNING *',
            [name, level, min_shipments, discount_percentage, is_active, id]
        );
        if (result.rows.length === 0) return error(res, 'Tier not found', 404);
        return success(res, 'Tier updated successfully', result.rows[0]);
    } catch (err) {

        return error(res, 'Failed to update tier', 500);
    }
};

export const deleteTier = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM user_tiers WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return error(res, 'Tier not found', 404);
        return success(res, 'Tier deleted successfully');
    } catch (err) {

        return error(res, 'Failed to delete tier', 500);
    }
};

export const setUserTier = async (req, res) => {
    const { userId } = req.params;
    const { tierId } = req.body;
    try {
        const userRes = await query('UPDATE users SET tier_id = $1 WHERE id = $2 RETURNING *', [tierId, userId]);
        if (userRes.rows.length === 0) return error(res, 'User not found', 404);
        return success(res, 'User tier updated successfully', { userId, tierId });
    } catch (err) {

        return error(res, 'Failed to set user tier', 500);
    }
};
