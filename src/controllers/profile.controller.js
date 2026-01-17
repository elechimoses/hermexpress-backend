import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';


export const completeProfile = async (req, res) => {
    // 1. Destructure all possible fields
    const { 
        // Common
        address, landmark, country, state, city, postal_code,
        // Personal
        date_of_birth,
        // Business
        business_name, business_type, registration_number, tax_id
    } = req.body;
    
    // 2. Handle File Upload (safe check)
    const idCardUrl = req.file ? req.file.path.replace(/\\/g, "/") : null;

    try {
        const userId = req.user.id;
        
        // 3. Check User Status
        const userRes = await query('SELECT account_type, is_profile_complete FROM users WHERE id = $1', [userId]);
        
        if (userRes.rows.length === 0) return error(res, 'User not found', 404);
        
        const { account_type, is_profile_complete } = userRes.rows[0];

        if (is_profile_complete) {
            return error(res, 'Profile is already completed', 400);
        }

        if (account_type === 'admin') {
             return error(res, 'Admins do not have user profiles', 400);
        }

        const isBusiness = account_type?.toLowerCase() === 'business';

        // 4. Dynamic Validation Helper
        // We define what is required for each type. 
        // Note: 'tax_id', 'landmark', 'postal_code', and 'id_card_url' are treated as optional based on your logic.
        
        let missingFields = [];

        if (isBusiness) {
            const businessRequired = [
                'business_name', 
                'business_type', 
                'registration_number', 
                'address', 
                'country', 
                'state', 
                'city'
            ];
            
            // Filter keys that are missing in req.body or empty strings
            missingFields = businessRequired.filter(field => !req.body[field]);

            if (missingFields.length > 0) {
                return error(res, `Missing required business fields: ${missingFields.join(', ')}`, 400);
            }

            // Insert Business Profile
            await query(
                `INSERT INTO business_profiles (
                    user_id, business_name, business_type, registration_number, tax_id, 
                    business_address, landmark, country, state, city, postal_code, id_card_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
                [
                    userId, 
                    business_name, 
                    business_type, 
                    registration_number, 
                    tax_id || null, // Handle optional field
                    address, 
                    landmark || null, 
                    country, 
                    state, 
                    city, 
                    postal_code || null, 
                    idCardUrl
                ]
            );

        } else {
            const personalRequired = [
                'date_of_birth', 
                'address', 
                'country', 
                'state', 
                'city'
            ];

            missingFields = personalRequired.filter(field => !req.body[field]);

            if (missingFields.length > 0) {
                return error(res, `Missing required personal fields: ${missingFields.join(', ')}`, 400);
            }
            
            // Insert Personal Profile
            await query(
                `INSERT INTO user_profiles (
                    user_id, date_of_birth, address, landmark, country, state, city, postal_code, id_card_url
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userId, 
                    date_of_birth, 
                    address, 
                    landmark || null, 
                    country, 
                    state, 
                    city, 
                    postal_code || null, 
                    idCardUrl
                ]
            );
        }

        // 5. Update User Status
        await query('UPDATE users SET is_profile_complete = TRUE WHERE id = $1', [userId]);
        
        return success(res, 'Profile completed successfully');

    } catch (err) {
        console.error('Profile Completion Error:', err);
        return error(res, 'Failed to complete profile', 500);
    }
};
export const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        
        // Fetch User + Basic Info
        const userRes = await query(
            `SELECT id, first_name, last_name, email, phone, country_dial_code, account_type, is_verified, is_profile_complete, avatar_url 
             FROM users WHERE id = $1`, 
            [userId]
        );
        
        if (userRes.rows.length === 0) return error(res, 'User not found', 404);
        const user = userRes.rows[0];

        let profileData = {};

        if (user.is_profile_complete) {
             const isBusiness = user.account_type?.toLowerCase() === 'business';
             if (isBusiness) {
                 const bizRes = await query('SELECT * FROM business_profiles WHERE user_id = $1', [userId]);
                 if (bizRes.rows.length > 0) profileData = bizRes.rows[0];
             } else {
                 const personalRes = await query('SELECT * FROM user_profiles WHERE user_id = $1', [userId]);
                 if (personalRes.rows.length > 0) profileData = personalRes.rows[0];
             }
        }

        return success(res, 'Profile fetched', { user, profile: profileData });

    } catch (err) {
        console.error('Get Profile Error:', err);
        return error(res, 'Failed to fetch profile', 500);
    }
};

export const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            first_name, last_name, phone, country_dial_code,
            address, landmark, country, state, city, postal_code,
            business_name, business_address 
        } = req.body;
        
        // Handle Avatar Upload
        let avatarUrl = null;
        if (req.file && req.file.fieldname === 'avatar') {
             avatarUrl = req.file.path.replace(/\\/g, "/");
        }

        // 1. Update User Basic Info
        await query(
            `UPDATE users SET 
             first_name = COALESCE($1, first_name),
             last_name = COALESCE($2, last_name),
             phone = COALESCE($3, phone),
             country_dial_code = COALESCE($4, country_dial_code),
             avatar_url = COALESCE($5, avatar_url)
             WHERE id = $6`,
            [first_name, last_name, phone, country_dial_code, avatarUrl, userId]
        );

        // 2. Update Profile Details if exists
        const userRes = await query('SELECT account_type, is_profile_complete FROM users WHERE id = $1', [userId]);
        const { account_type, is_profile_complete } = userRes.rows[0];

        if (is_profile_complete) {
             const isBusiness = account_type?.toLowerCase() === 'business';
             
             if (isBusiness) {
                 // Map generic 'address' to 'business_address' if needed, or use specific fields
                 // Mockup shows "Address" label. In DB it's business_address.
                 // We'll update provided fields.
                 await query(
                    `UPDATE business_profiles SET
                     business_name = COALESCE($1, business_name),
                     business_address = COALESCE($2, business_address),
                     landmark = COALESCE($3, landmark),
                     country = COALESCE($4, country),
                     state = COALESCE($5, state),
                     city = COALESCE($6, city),
                     postal_code = COALESCE($7, postal_code)
                     WHERE user_id = $8`,
                    [business_name, address || business_address, landmark, country, state, city, postal_code, userId]
                 );
             } else {
                 await query(
                    `UPDATE user_profiles SET
                     address = COALESCE($1, address),
                     landmark = COALESCE($2, landmark),
                     country = COALESCE($3, country),
                     state = COALESCE($4, state),
                     city = COALESCE($5, city),
                     postal_code = COALESCE($6, postal_code)
                     WHERE user_id = $7`,
                    [address, landmark, country, state, city, postal_code, userId]
                 );
             }
        }

        return success(res, 'Profile updated successfully');

    } catch (err) {
        console.error('Update Profile Error:', err);
        return error(res, 'Failed to update profile', 500);
    }
};
