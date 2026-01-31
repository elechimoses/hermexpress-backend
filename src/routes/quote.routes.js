import express from 'express';
import { getCountries, getCities } from '../controllers/location.controller.js';
import { getQuote, getChinaRateDescription } from '../controllers/quote.controller.js';

const router = express.Router();

router.get('/locations/countries', getCountries);
router.get('/locations/cities', getCities);
router.post('/quote', getQuote);
router.get('/china-rate', getChinaRateDescription);

export default router;
