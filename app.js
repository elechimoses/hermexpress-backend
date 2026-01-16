import express from 'express';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Construct __dirname in ESM
import { fileURLToPath } from 'url';
import path from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(cors());

// Serve Static Uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

import { apiLimiter } from './src/middleware/rateLimit.middleware.js';
app.use('/api', apiLimiter);
app.use('/auth', apiLimiter);

import authRouter from './src/routes/auth.routes.js';
import quoteRouter from './src/routes/quote.routes.js';
import adminRouter from './src/routes/admin.routes.js';
import userRouter from './src/routes/user.routes.js';

import shipmentRouter from './src/routes/shipment.routes.js';
import paymentRouter from './src/routes/payment.routes.js';
import categoryRouter from './src/routes/category.routes.js';

app.use('/api/auth', authRouter);
app.use('/api', quoteRouter);
app.use('/api/shipments', shipmentRouter);
app.use('/api/payment', paymentRouter);
app.use('/api/categories', categoryRouter);

app.use('/api/user', userRouter);
app.use('/api/admin', adminRouter);

app.get('/', (req, res) => {
  res.send('Hermes Express API');
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        status: false,
        message: 'Route not found'
    });
});

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;