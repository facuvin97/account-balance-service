import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

const post = (accountId: string) =>
  request(app).post(`/accounts/${accountId}/withdrawals`);

describe('POST /accounts/:accountId/withdrawals', () => {
  describe('Happy path', () => {
    it('returns 201 with updated balance and entryId, and updates DB', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '500.00');

      const res = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        balance: '400.00',
        entryId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
      });

      const updated = await db.Account.findByPk(account.id);
      expect(updated!.cachedBalance).toBe('400.00');

      const entry = await db.LedgerEntry.findByPk(res.body.entryId);
      expect(entry!.type).toBe('withdrawal');
      expect(entry!.amount).toBe('100.00');
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth cookie', async () => {
      const account = await createAccount(crypto.randomUUID(), 'USD', '500.00');

      const res = await post(account.id)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(401);
    });

    it('returns 403 when account belongs to a different user', async () => {
      const owner = crypto.randomUUID();
      const account = await createAccount(owner, 'USD', '500.00');

      const res = await post(account.id)
        .set('Cookie', `token=${generateToken(crypto.randomUUID())}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '100.00' });

      expect(res.status).toBe(403);
    });
  });

  describe('Input validation', () => {
    let token: string;
    let accountId: string;

    beforeEach(async () => {
      const userId = crypto.randomUUID();
      token = generateToken(userId);
      accountId = (await createAccount(userId, 'USD', '1000.00')).id;
    });

    it.each([
      ['negativo', '-5.00'],
      ['cero', '0'],
      ['cero decimal', '0.00'],
      ['más de 2 decimales', '10.999'],
      ['no numérico', 'xyz'],
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
        .send({ amount: 50 });

      expect(res.status).toBe(400);
    });

    it('returns 400 when accountId is not a valid UUID', async () => {
      const res = await post('invalid-uuid')
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '50.00' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when Idempotency-Key header is missing', async () => {
      const res = await post(accountId)
        .set('Cookie', `token=${token}`)
        .send({ amount: '50.00' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/idempotency/i);
    });
  });

  describe('Business rules', () => {
    it('returns 404 for nonexistent account', async () => {
      const res = await post(crypto.randomUUID())
        .set('Cookie', `token=${generateToken(crypto.randomUUID())}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '50.00' });

      expect(res.status).toBe(404);
    });

    it('returns 409 for insufficient funds and leaves balance unchanged', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '50.00');

      const res = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '200.00' });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'CONFLICT' } });

      // Balance sin cambios
      const notUpdated = await db.Account.findByPk(account.id);
      expect(notUpdated!.cachedBalance).toBe('50.00');

      // Sin ledger entries creados
      const { count } = await db.LedgerEntry.findAndCountAll({
        where: { accountId: account.id },
      });
      expect(count).toBe(0);
    });
  });

  describe('Idempotency', () => {
    it('returns identical response on replay without duplicating the withdrawal', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '1000.00');
      const idemKey = crypto.randomUUID();

      const first = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '300.00' });

      const second = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '300.00' });

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body).toEqual(first.body);

      // Un solo ledger entry
      const { count } = await db.LedgerEntry.findAndCountAll({
        where: { accountId: account.id },
      });
      expect(count).toBe(1);

      // Balance refleja un solo retiro
      const updated = await db.Account.findByPk(account.id);
      expect(updated!.cachedBalance).toBe('700.00');
    });

    it('caches the 409 rejection and replays it on retry with same key', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '10.00');
      const idemKey = crypto.randomUUID();

      const first = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '999.00' });

      const second = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '999.00' });

      expect(first.status).toBe(409);
      expect(second.status).toBe(409);
      expect(second.body).toEqual(first.body);
    });

    it('returns 409 when key is reused with different amount', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '500.00');
      const idemKey = crypto.randomUUID();

      await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '100.00' });

      const res = await post(account.id)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', idemKey)
        .send({ amount: '200.00' });

      expect(res.status).toBe(409);
    });
  });
});
