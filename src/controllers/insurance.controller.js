import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

export const createInsurancePolicy = async (req, res) => {
    const { name, description, coverage_percentage, fee_type, fee_amount, min_fee, is_active } = req.body;

    if (!name || !fee_type || !fee_amount) {
        return error(res, 'Name, fee_type, and fee_amount are required', 400);
    }

    try {
        const result = await query(
            `INSERT INTO insurance_policies (name, description, coverage_percentage, fee_type, fee_amount, min_fee, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, description, coverage_percentage || 0, fee_type, fee_amount, min_fee || 0, is_active !== undefined ? is_active : true]
        );
        return success(res, 'Insurance policy created', result.rows[0], 201);
    } catch (err) {
        console.error('Create Insurance Error:', err);
        return error(res, 'Failed to create insurance policy', 500);
    }
};

export const updateInsurancePolicy = async (req, res) => {
    const { id } = req.params;
    const { name, description, coverage_percentage, fee_type, fee_amount, min_fee, is_active } = req.body;

    try {
        let updateQuery = 'UPDATE insurance_policies SET ';
        const params = [];
        let paramIndex = 1;

        const updates = { name, description, coverage_percentage, fee_type, fee_amount, min_fee, is_active };

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                updateQuery += `${key} = $${paramIndex}, `;
                params.push(value);
                paramIndex++;
            }
        }

        if (params.length === 0) return error(res, 'No fields to update', 400);

        updateQuery = updateQuery.slice(0, -2); // Remove last comma
        updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
        params.push(id);

        const result = await query(updateQuery, params);
        if (result.rows.length === 0) return error(res, 'Policy not found', 404);

        return success(res, 'Insurance policy updated', result.rows[0]);
    } catch (err) {
        console.error('Update Insurance Error:', err);
        return error(res, 'Failed to update insurance policy', 500);
    }
};

export const deleteInsurancePolicy = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM insurance_policies WHERE id = $1 RETURNING *', [id]);
        if (result.rows.length === 0) return error(res, 'Policy not found', 404);
        return success(res, 'Insurance policy deleted');
    } catch (err) {
        console.error('Delete Insurance Error:', err);
        return error(res, 'Failed to delete insurance policy', 500);
    }
};

export const getInsurancePolicies = async (req, res) => {
    try {
        const result = await query('SELECT * FROM insurance_policies ORDER BY id ASC');
        return success(res, 'All insurance policies', result.rows);
    } catch (err) {
        console.error('Get Insurance Error:', err);
        return error(res, 'Failed to fetch policies', 500);
    }
};
