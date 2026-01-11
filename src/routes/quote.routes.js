import express from 'express';
import { getCountries, getCities } from '../controllers/location.controller.js';
import { getQuote } from '../controllers/quote.controller.js';

const router = express.Router();

router.get('/locations/countries', getCountries);
router.get('/locations/cities', getCities);
router.post('/quote', getQuote);

export default router;
