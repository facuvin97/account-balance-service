import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),

  JWT_SECRET: z.string().min(1),

  CORS_ORIGIN: z.string().min(1).optional(),
}).refine(
  (data) => data.NODE_ENV !== 'production' || data.CORS_ORIGIN,
  { message: 'CORS_ORIGIN is required in production', path: ['CORS_ORIGIN'] },
);

export const env = envSchema.parse(process.env);
