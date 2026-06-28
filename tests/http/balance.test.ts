import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

const get = (accountId: string) =>
  request(app).get(`/accounts/${accountId}/balance`);

describe('GET /accounts/:accountId/balance', () => {
  describe('Happy path', () => {
    it('returns 200 with accountId, currency and balance', async () => {
      const userId = crypto.randomUUID();
      const account = await createAccount(userId, 'USD', '123.45');

      const res = await get(account.id).set(
        'Cookie',
        `token=${generateToken(userId)}`,
      );

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        accountId: account.id,
        currency: 'USD',
        balance: '123.45',
      });
    });

    it('reflects balance after deposits', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '0.00');

      await request(app)
        .post(`/accounts/${account.id}/deposits`)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ amount: '250.00' });

      const res = await get(account.id).set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.balance).toBe('250.00');
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth cookie', async () => {
      const account = await createAccount(crypto.randomUUID());

      const res = await get(account.id);

      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ error: { code: expect.any(String) } });
    });

    it('returns 403 when account belongs to a different user', async () => {
      const owner = crypto.randomUUID();
      const account = await createAccount(owner);

      const res = await get(account.id).set(
        'Cookie',
        `token=${generateToken(crypto.randomUUID())}`,
      );

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  });

  describe('Input validation', () => {
    it('returns 400 when accountId is not a valid UUID', async () => {
      const res = await get('not-a-valid-uuid').set(
        'Cookie',
        `token=${generateToken(crypto.randomUUID())}`,
      );

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });
  });

  describe('Business rules', () => {
    it('returns 404 for nonexistent account', async () => {
      const res = await get(crypto.randomUUID()).set(
        'Cookie',
        `token=${generateToken(crypto.randomUUID())}`,
      );

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: { code: 'NOT_FOUND' } });
    });
  });
});
