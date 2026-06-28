import dotenv from 'dotenv';
dotenv.config();
process.env.NODE_ENV = 'test';

import db from '../../src/database';
import { truncateAll } from './truncate';

// Conecta a DB de test al inicio
beforeAll(async () => {
  await db.sequelize.authenticate();
});

// Vacía tablas antes de cada test
beforeEach(async () => {
  await truncateAll();
});

// Cierra conexión al terminar
afterAll(async () => {
  await db.sequelize.close();
});
