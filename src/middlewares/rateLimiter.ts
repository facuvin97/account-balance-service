import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const noop: RequestHandler = (_req, _res, next) => next();

export const financialLimiter =
  env.NODE_ENV === 'test'
    ? noop
    : rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 20,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later' },
      });
