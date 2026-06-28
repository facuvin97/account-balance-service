import db from '../../src/database';

const TABLES = ['ledger_entries', 'transfers', 'idempotency_keys', 'accounts'];

// Vacía todas las tablas respetando FKs con CASCADE
export async function truncateAll(): Promise<void> {
  await db.sequelize.query(
    `TRUNCATE ${TABLES.join(', ')} RESTART IDENTITY CASCADE`,
  );
}
