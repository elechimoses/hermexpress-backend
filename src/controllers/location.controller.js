import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

export const getCountries = async (req, res) => {
  const { type } = req.query; // 'import' or 'export'

  try {
    let sql = 'SELECT id, name, code FROM countries WHERE is_active = TRUE';
    const params = [];

    if (type === 'import') {
      // Return countries we can import FROM
      sql += ' AND can_import_from = TRUE';
    } else if (type === 'export') {
      // Return countries we can export TO
      sql += ' AND can_export_to = TRUE';
    }

    sql += ' ORDER BY name ASC';

    const result = await query(sql, params);
    return success(res, 'Countries fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching countries:', err);
    return error(res, 'Server error', 500);
  }
};

export const getCities = async (req, res) => {
  const { countryCode } = req.query;
  // Default to NG if not specified, though logic mainly supports NG cities for now
  const code = countryCode || 'NG';

  try {
    // First get country ID
    const countryRes = await query('SELECT id FROM countries WHERE code = $1', [code]);
    
    if (countryRes.rows.length === 0) {
        return error(res, 'Country not found', 404);
    }

    const countryId = countryRes.rows[0].id;

    const result = await query(
        'SELECT id, name, state FROM cities WHERE country_id = $1 AND is_active = TRUE ORDER BY name ASC', 
        [countryId]
    );

    return success(res, 'Cities fetched successfully', result.rows);
  } catch (err) {
    console.error('Error fetching cities:', err);
    return error(res, 'Server error', 500);
  }
};
