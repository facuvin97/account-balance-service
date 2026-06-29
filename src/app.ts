import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { errorHandler } from './middlewares/errorHandler';
import { financialLimiter } from './middlewares/rateLimiter';
import accountRoutes from './routes/accountRoutes';
import transferRoutes from './routes/transferRoutes';

const app: Application = express();

app.use(cors({
  origin: env.CORS_ORIGIN ?? true,
  credentials: true,
}));
app.use(helmet());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(cookieParser());
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/accounts', financialLimiter, accountRoutes);
app.use('/transfers', financialLimiter, transferRoutes);

app.use(errorHandler);

export default app;
