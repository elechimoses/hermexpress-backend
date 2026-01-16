import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

export const createCategory = async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
        return error(res, 'Category name is required', 400);
    }

    try {
        const result = await query(
            'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
            [name, description]
        );
        return success(res, 'Category created successfully', result.rows[0]);
    } catch (err) {
        console.error('Create Category Error:', err);
        if (err.code === '23505') { // Unique violation
            return error(res, 'Category with this name already exists', 409);
        }
        return error(res, 'Failed to create category', 500);
    }
};

export const getCategories = async (req, res) => {
    try {
        const result = await query('SELECT * FROM categories ORDER BY name ASC');
        return success(res, 'Categories fetched successfully', result.rows);
    } catch (err) {
        console.error('Get Categories Error:', err);
        return error(res, 'Failed to fetch categories', 500);
    }
};
