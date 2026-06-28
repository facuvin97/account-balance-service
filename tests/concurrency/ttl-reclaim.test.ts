import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';
import { createFingerprint } from '../../src/services/idempotencyHelper';

// Reclamo de idempotency key vencida por TTL
describe('TTL reclaim of stale processing key', () => {
  it('rejects retry while key is fresh (< 10s)', async () => {
    const userId = crypto.randomUUID();
    const token = generateToken(userId);
    const account = await createAccount(userId, 'USD', '0.00');

    const AMOUNT = '50.00';
    const KEY = 'ttl-fresh-key';
    const fingerprint = createFingerprint(account.id, AMOUNT, 'deposit');

    // Insertar key en processing con updated_at = NOW (fresca)
    await db.sequelize.query(
      `INSERT INTO idempotency_keys (id, user_id, key, request_fingerprint, status, created_at, updated_at)
       VALUES (gen_random_uuid(), :userId, :key, :fingerprint, 'processing', NOW(), NOW())`,
      { replacements: { userId, key: KEY, fingerprint } },
    );

    const res = await request(app)
      .post(`/accounts/${account.id}/deposits`)
      .set('Cookie', `token=${token}`)
      .set('Idempotency-Key', KEY)
      .send({ amount: AMOUNT });

    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/in progress/i);
  });

  it('reclaims a stale key (> 10s) and processes the operation', async () => {
    const userId = crypto.randomUUID();
    const token = generateToken(userId);
    const account = await createAccount(userId, 'USD', '0.00');

    const AMOUNT = '77.00';
    const KEY = 'ttl-stale-key';
    const fingerprint = createFingerprint(account.id, AMOUNT, 'deposit');

    // Insertar key en processing con updated_at hace 15s (vencida)
    await db.sequelize.query(
      `INSERT INTO idempotency_keys (id, user_id, key, request_fingerprint, status, created_at, updated_at)
       VALUES (gen_random_uuid(), :userId, :key, :fingerprint, 'processing',
               NOW() - INTERVAL '15 seconds', NOW() - INTERVAL '15 seconds')`,
      { replacements: { userId, key: KEY, fingerprint } },
    );

    const res = await request(app)
      .post(`/accounts/${account.id}/deposits`)
      .set('Cookie', `token=${token}`)
      .set('Idempotency-Key', KEY)
      .send({ amount: AMOUNT });

    // Debe reclamar la key y procesar exitosamente
    expect(res.status).toBe(201);
    expect(res.body.balance).toBe('77.00');

    // Key debe quedar como completed
    const [rows] = await db.sequelize.query(
      `SELECT status FROM idempotency_keys WHERE user_id = :userId AND key = :key`,
      { replacements: { userId, key: KEY } },
    );
    expect((rows[0] as { status: string }).status).toBe('completed');
  });
});
