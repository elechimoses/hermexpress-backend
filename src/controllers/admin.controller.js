import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

// --- Countries ---

export const createCountry = async (req, res) => {
  const { name, code, can_import_from, can_export_to, is_active } = req.body;
  try {
    const result = await query(
      `INSERT INTO countries (name, code, can_import_from, can_export_to, is_active)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, code, can_import_from || false, can_export_to || false, is_active || true]
    );
    return success(res, 'Country created', result.rows[0], 201);
  } catch (err) {
    return error(res, 'Failed to create country', 500);
  }
};

export const updateCountry = async (req, res) => {
  const { id } = req.params;
  const { name, code, can_import_from, can_export_to, is_active } = req.body;
  try {
    const result = await query(
      `UPDATE countries SET 
       name = COALESCE($1, name),
       code = COALESCE($2, code),
       can_import_from = COALESCE($3, can_import_from),
       can_export_to = COALESCE($4, can_export_to),
       is_active = COALESCE($5, is_active)
       WHERE id = $6 RETURNING *`,
      [name, code, can_import_from, can_export_to, is_active, id]
    );
    if (result.rows.length === 0) return error(res, 'Country not found', 404);
    return success(res, 'Country updated', result.rows[0]);
  } catch (err) {
    return error(res, 'Failed to update country', 500);
  }
};

export const getCountries = async (req, res) => {
  try {
    const result = await query('SELECT * FROM countries ORDER BY name ASC');
    return success(res, 'Countries fetched', result.rows);
  } catch (err) {
    return error(res, 'Failed to fetch countries', 500);
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

// --- Options ---
export const createOption = async (req, res) => {
    const { name, description, min_days, max_days, is_active } = req.body;
    try {
        const result = await query(
            `INSERT INTO shipment_options (name, description, min_days, max_days, is_active)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [name, description, min_days, max_days, is_active || true]
        );
        return success(res, 'Option created', result.rows[0], 201);
    } catch(err) {
        return error(res, 'Failed to create option', 500);
    }
};

export const updateOption = async (req, res) => {
    const { id } = req.params;
    const { name, description, min_days, max_days, is_active } = req.body;
    try {
        const result = await query(
            `UPDATE shipment_options SET
             name = COALESCE($1, name),
             description = COALESCE($2, description),
             min_days = COALESCE($3, min_days),
             max_days = COALESCE($4, max_days),
             is_active = COALESCE($5, is_active)
             WHERE id = $6 RETURNING *`,
            [name, description, min_days, max_days, is_active, id]
        );
        if (result.rows.length === 0) return error(res, 'Option not found', 404);
        return success(res, 'Option updated', result.rows[0]);
    } catch(err) {
        return error(res, 'Failed to update option', 500);
    }
};

export const getOptions = async (req, res) => {
    try {
        const result = await query('SELECT * FROM shipment_options ORDER BY name ASC');
        return success(res, 'Options fetched', result.rows);
    } catch(err) {
        return error(res, 'Failed to fetch options', 500);
    }
};

// --- Rates ---

export const createRate = async (req, res) => {
  const { 
    pickup_country_id, destination_country_id, 
    pickup_city_id, destination_city_id,
    shipment_option_id, service_type, 
    min_weight, max_weight, base_fee, rate_per_kg 
  } = req.body;

  try {
    const result = await query(
      `INSERT INTO shipping_rates 
       (pickup_country_id, destination_country_id, pickup_city_id, destination_city_id, shipment_option_id, service_type, min_weight, max_weight, base_fee, rate_per_kg)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [pickup_country_id, destination_country_id, pickup_city_id || null, destination_city_id || null, shipment_option_id, service_type, min_weight, max_weight, base_fee, rate_per_kg]
    );
    return success(res, 'Rate created', result.rows[0], 201);
  } catch (err) {
    return error(res, 'Failed to create rate', 500);
  }
};

export const updateRate = async (req, res) => {
  const { id } = req.params;
  const { 
      pickup_country_id, destination_country_id, 
      pickup_city_id, destination_city_id,
      shipment_option_id, service_type, 
      min_weight, max_weight, base_fee, rate_per_kg 
  } = req.body;

  try {
     const result = await query(
      `UPDATE shipping_rates SET
       pickup_country_id = COALESCE($1, pickup_country_id),
       destination_country_id = COALESCE($2, destination_country_id),
       pickup_city_id = COALESCE($3, pickup_city_id),
       destination_city_id = COALESCE($4, destination_city_id),
       shipment_option_id = COALESCE($5, shipment_option_id),
       service_type = COALESCE($6, service_type),
       min_weight = COALESCE($7, min_weight),
       max_weight = COALESCE($8, max_weight),
       base_fee = COALESCE($9, base_fee),
       rate_per_kg = COALESCE($10, rate_per_kg)
       WHERE id = $11 RETURNING *`,
      [pickup_country_id, destination_country_id, pickup_city_id, destination_city_id, shipment_option_id, service_type, min_weight, max_weight, base_fee, rate_per_kg, id]
     );
     if (result.rows.length === 0) return error(res, 'Rate not found', 404);
     return success(res, 'Rate updated', result.rows[0]);
  } catch(err) {
      return error(res, 'Failed to update rate', 500);
  }
};

export const deleteRate = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await query('DELETE FROM shipping_rates WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) return error(res, 'Rate not found', 404);
        return success(res, 'Rate deleted', null);
    } catch(err) {
        return error(res, 'Failed to delete rate', 500);
    }
}

export const getRates = async (req, res) => {
    const { pickup_country_id, destination_country_id, pickup_city_id, destination_city_id, service_type } = req.query;
    let queryStr = `
      SELECT r.*, 
             pc.name as pickup_country, dc.name as destination_country,
             pcity.name as pickup_city, dcity.name as destination_city,
             so.name as option_name
      FROM shipping_rates r
      JOIN countries pc ON r.pickup_country_id = pc.id
      JOIN countries dc ON r.destination_country_id = dc.id
      LEFT JOIN cities pcity ON r.pickup_city_id = pcity.id
      LEFT JOIN cities dcity ON r.destination_city_id = dcity.id
      JOIN shipment_options so ON r.shipment_option_id = so.id
    `;
    
    queryStr += ' ORDER BY r.created_at DESC';

    try {
        const result = await query(queryStr);
        return success(res, 'Rates fetched', result.rows);
    } catch(err) {
        return error(res, 'Failed to fetch rates', 500);
    }
};
