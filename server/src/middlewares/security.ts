import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { getCorsOrigins } from '../config/env';
import { AppError } from './error';

export const securityHeaders = helmet();

export const corsMiddleware = cors({
  credentials: true,
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (getCorsOrigins().includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new AppError('CORS origin rejected', 403, 'CORS_ORIGIN_REJECTED'));
  },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts', code: 'RATE_LIMITED' },
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many AI generation requests', code: 'RATE_LIMITED' },
});
