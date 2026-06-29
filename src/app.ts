import express, { Application } from 'express';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { errorHandler } from './middlewares/errorHandler';
import { financialLimiter } from './middlewares/rateLimiter';
import accountRoutes from './routes/accountRoutes';
import transferRoutes from './routes/transferRoutes';

const app: Application = express();

app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/accounts', financialLimiter, accountRoutes);
app.use('/transfers', financialLimiter, transferRoutes);

app.use(errorHandler);

export default app;
