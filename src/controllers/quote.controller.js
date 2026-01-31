import { query } from '../db/index.js';
import { success, error } from '../utils/reponse.js';

export const getQuote = async (req, res) => {
  const { 
    serviceType,          // 'import' | 'export'
    pickupCountryId,      // ID of pickup country
    destinationCountryId, // ID of destination country
    pickupCityId,         // Optional ID
    destinationCityId,    // Optional ID
    weight,               // actual weight kg
    length, width, height,// dimensions cm
    isVolumetric = false,  // boolean
    value = 0             // Declared value for insurance calculation
  } = req.body;

  // --- 1. Basic Validation ---
  if (!serviceType) return error(res, 'Service type is required', 400);
  if (!['import', 'export'].includes(serviceType)) {
    return error(res, 'Service type must be "import" or "export"', 400);
  }

  if (!pickupCountryId) return error(res, 'Pickup country is required', 400);
  if (!destinationCountryId) return error(res, 'Destination country is required', 400);

  // Validate Weight vs Volumetric
  if (isVolumetric) {
      if (!length || !width || !height) {
          return error(res, 'Dimensions (length, width, height) are required for volumetric weight', 400);
      }
  } else {
      if (!weight || Number(weight) <= 0) {
          return error(res, 'Positive weight is required', 400);
      }
  }

  try {
    // --- 2. Validate Locations (Respect Admin Settings) ---
    
    // Check Pickup Country
    const pickupRes = await query('SELECT * FROM countries WHERE id = $1 AND is_active = TRUE', [pickupCountryId]);
    if (pickupRes.rows.length === 0) return error(res, 'Invalid or inactive pickup country', 400);
    const pickupCountry = pickupRes.rows[0];

    // Check Destination Country
    const destRes = await query('SELECT * FROM countries WHERE id = $1 AND is_active = TRUE', [destinationCountryId]);
    if (destRes.rows.length === 0) return error(res, 'Invalid or inactive destination country', 400);
    const destinationCountry = destRes.rows[0];

    // Check Cities if provided
    if (pickupCityId) {
        const pCityRes = await query('SELECT * FROM cities WHERE id = $1 AND country_id = $2 AND is_active = TRUE', [pickupCityId, pickupCountryId]);
        if (pCityRes.rows.length === 0) return error(res, 'Invalid or inactive pickup city', 400);
    }

    if (destinationCityId) {
        const dCityRes = await query('SELECT * FROM cities WHERE id = $1 AND country_id = $2 AND is_active = TRUE', [destinationCityId, destinationCountryId]);
        if (dCityRes.rows.length === 0) return error(res, 'Invalid or inactive destination city', 400);
    }

    // --- 3. Validate Service Feasibility ---
    // Rules:
    // Import: Pickup Country must be "can_import_from"
    // Export: Destination Country must be "can_export_to"
    
    if (serviceType === 'import') {
        if (!pickupCountry.can_import_from) {
            return error(res, `Import servcies are not available from ${pickupCountry.name}`, 400);
        }
    } else { // export
        if (!destinationCountry.can_export_to) {
             return error(res, `Export services are not available to ${destinationCountry.name}`, 400);
        }
    }

    // --- 4. Calculate Chargeable Weight ---
    let chargeableWeight = 0;
    if (isVolumetric) {
        const volWeight = (Number(length) * Number(width) * Number(height)) / 5000;
        chargeableWeight = volWeight;
    } else {
        chargeableWeight = Number(weight);
    }

    // --- 5. Find Matching Rate ---
    // Logic: 
    // - Match Pickup & Destination Countries
    // - Match Service Type
    // - Match Weight Range
    // - Match Active Option
    // - Specificity: Prefer rates with matching City IDs over NULL City IDs (Generic).
    
    const rateQuery = `
      SELECT DISTINCT ON (r.shipment_option_id)
        r.id,
        r.base_fee,
        r.rate_per_kg,
        r.min_weight,
        r.max_weight,
        o.name AS option_name,
        o.description AS option_desc,
        o.min_days,
        o.max_days
      FROM shipping_rates r
      JOIN shipment_options o ON r.shipment_option_id = o.id
      WHERE 
        r.pickup_country_id = $1
        AND r.destination_country_id = $2
        AND (r.pickup_city_id IS NULL OR r.pickup_city_id = $3)
        AND (r.destination_city_id IS NULL OR r.destination_city_id = $4)
        AND r.service_type = $5
        AND $6 >= r.min_weight
        AND $6 <= r.max_weight
        AND o.is_active = true
      ORDER BY 
        r.shipment_option_id, 
        ((r.pickup_city_id IS NOT NULL)::int + (r.destination_city_id IS NOT NULL)::int) DESC
    `;

    const ratesResult = await query(rateQuery, [
      pickupCountryId,
      destinationCountryId,
      pickupCityId || null,
      destinationCityId || null,
      serviceType,
      chargeableWeight
    ]);

    if (ratesResult.rows.length === 0) {
      return success(res, 'No shipping options available for this route and weight', []);
    }

    // --- 6. Format Response ---
    const quotes = ratesResult.rows.map(r => {
      const base = Number(r.base_fee);
      const perKg = Number(r.rate_per_kg);
      const total = Math.round(base + (chargeableWeight * perKg));

      return {
        name: r.option_name,
        description: r.option_desc || '',
        price: total,
        formattedPrice: `₦${total.toLocaleString('en-NG')}`,
        eta: `${r.min_days} - ${r.max_days} Working days`,
        slug: r.option_name.toLowerCase().replace(/\s+/g, '-'),
        weightUsed: chargeableWeight,
        isVolumetricUsed: !!isVolumetric
      };
    });

    // --- 7. Fetch Insurance Options ---
    const insuranceRes = await query('SELECT * FROM insurance_policies WHERE is_active = TRUE');
    const insuranceOptions = insuranceRes.rows.map(p => {
        let fee = 0;
        const packageValue = Number(value) || 0;

        if (p.fee_type === 'flat') {
            fee = Number(p.fee_amount);
        } else { // percentage
             fee = (packageValue * (Number(p.fee_amount) / 100));
        }

        // Apply Minimum Fee Logic
        if (Number(p.min_fee) > 0 && fee < Number(p.min_fee) && p.fee_type === 'percentage') {
             fee = Number(p.min_fee);
        }

        return {
            id: p.id,
            name: p.name,
            description: p.description,
            fee: fee,
            formattedFee: fee === 0 ? 'Free' : `₦${fee.toLocaleString('en-NG')}`,
            coverage: p.coverage_percentage
        };
    });

    return success(res, 'Quotes calculated successfully', { 
      quotes,
      insuranceOptions,
      chargeableWeight,
      actualWeight: weight ? Number(weight) : null
    });

  } catch (err) {
    console.error('Quote endpoint error:', err);
    return error(res, 'Failed to calculate shipping quote', 500);
  }
};

export const getChinaRateDescription = async (req, res) => {
    try {
        const result = await query("SELECT value FROM settings WHERE key = 'china_rate_description'");
        const description = result.rows[0]?.value || 'Rate not available';
        return success(res, 'China rate description fetched', { description });
    } catch (err) {
        console.error('Get China Rate Error:', err);
        return error(res, 'Failed to fetch China rate description', 500);
    }
};
