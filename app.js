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

app.set('trust proxy', 1);

import { apiLimiter } from './src/middleware/rateLimit.middleware.js';
app.use('/api', apiLimiter);
app.use('/auth', apiLimiter);

import indexRouter from './src/routes/index.route.js';






app.get('/', (req, res) => {
  res.send('Hermes Express API');
});

app.use('/', indexRouter);


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