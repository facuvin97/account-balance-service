// Purga idempotency keys vencidas. Correr via cron externo: npx tsx scripts/cleanup-idempotency-keys.ts
import dotenv from 'dotenv';
dotenv.config();

import { Op } from 'sequelize';
import db from '../src/database';
import { IdempotencyKey } from '../src/database/models/IdempotencyKey';

const COMPLETED_TTL_DAYS = 7;
const STALE_PROCESSING_TTL_HOURS = 1;

async function cleanup(): Promise<void> {
  await db.sequelize.authenticate();

  const completedThreshold = new Date(Date.now() - COMPLETED_TTL_DAYS * 24 * 60 * 60 * 1000);
  const processingThreshold = new Date(Date.now() - STALE_PROCESSING_TTL_HOURS * 60 * 60 * 1000);

  // Elimina keys completadas hace más de 7 días
  const deletedCompleted = await IdempotencyKey.destroy({
    where: {
      status: 'completed',
      updatedAt: { [Op.lt]: completedThreshold },
    },
  });

  // Elimina keys abandonadas en processing hace más de 1 hora
  const deletedStale = await IdempotencyKey.destroy({
    where: {
      status: 'processing',
      updatedAt: { [Op.lt]: processingThreshold },
    },
  });

  console.log(`Cleanup done: ${deletedCompleted} completed (>7d), ${deletedStale} stale processing (>1h)`);

  await db.sequelize.close();
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
