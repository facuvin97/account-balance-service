import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

const post = (accountId: string) =>
  request(app).post(`/accounts/${accountId}/deposits`);

describe('POST /accounts/:accountId/deposits', () => {
  describe('Happy path', () => {
    it('returns 201 with balance and entryId, and updates DB', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '0.00');

      const res = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '150.00' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        balance: '150.00',
        entryId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
      });

      // Balance en DB actualizado
      const updated = await db.Account.findByPk(account.id);
      expect(updated!.cachedBalance).toBe('150.00');

      // Ledger entry creado con tipo y monto correctos
      const entry = await db.LedgerEntry.findByPk(res.body.entryId);
      expect(entry).not.toBeNull();
      expect(entry!.type).toBe('deposit');
      expect(entry!.amount).toBe('150.00');
      expect(entry!.accountId).toBe(account.id);
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth cookie', async () => {
      const account = await createAccount(crypto.randomUUID());

      const res = await post(account.id)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: expect.any(String) } });
    });

    it('returns 403 when account belongs to a different user', async () => {
      const owner = crypto.randomUUID();
      const attacker = crypto.randomUUID();
      const account = await createAccount(owner);

      const res = await post(account.id)
        .set('Cookie', `token=${generateToken(attacker)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  });

  describe('Input validation', () => {
    let token: string;
    let accountId: string;

    beforeEach(async () => {
      const userId = crypto.randomUUID();
      token = generateToken(userId);
      accountId = (await createAccount(userId)).id;
    });

    it.each([
      ['negativo', '-10.00'],
      ['cero (string)', '0'],
      ['cero (decimal)', '0.00'],
      ['más de 2 decimales', '10.123'],
      ['no numérico', 'abc'],
    ])('returns 400 for amount %s', async (_, amount) => {
      const res = await post(accountId)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('returns 400 when amount is a number (not a string)', async () => {
      const res = await post(accountId)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: 100 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when body is missing', async () => {
      const res = await post(accountId)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID());

      expect(res.status).toBe(400);
    });

    it('returns 400 when accountId is not a valid UUID', async () => {
      const res = await post('not-a-uuid')
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when Idempotency-Key header is missing', async () => {
      const res = await post(accountId)
        .set('Cookie', `token=${token}`)
        .send({ amount: '100.00' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/idempotency/i);
    });
  });

  describe('Business rules', () => {
    it('returns 404 for nonexistent account', async () => {
      const userId = crypto.randomUUID();

      const res = await post(crypto.randomUUID())
        .set('Cookie', `token=${generateToken(userId)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(404);
    });
  });

  describe('Idempotency', () => {
    it('returns identical response on replay without duplicating the deposit', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '0.00');
      const idemKey = crypto.randomUUID();

      const first = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '200.00' });

      const second = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '200.00' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body).toEqual(first.body);

      // Un solo ledger entry
      const { count } = await db.LedgerEntry.findAndCountAll({
        where: { accountId: account.id },
      });
      expect(count).toBe(1);

      // Balance refleja un solo depósito
      const updated = await db.Account.findByPk(account.id);
      expect(updated!.cachedBalance).toBe('200.00');
    });

    it('returns 409 when key is reused with different amount', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId);
      const idemKey = crypto.randomUUID();

      await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '100.00' });

      const res = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '999.00' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'CONFLICT' } });
    });
  });
});
