import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

const get = (accountId: string, query = '') =>
  request(app).get(`/accounts/${accountId}/ledger-entries${query}`);

// Crea un depósito en la cuenta dada
const deposit = (accountId: string, token: string, amount: string) =>
  request(app)
    .post(`/accounts/${accountId}/deposits`)
    .set('Cookie', `token=${token}`)
    .set('Idempotency-Key', crypto.randomUUID())
    .send({ amount });

describe('GET /accounts/:accountId/ledger-entries', () => {
  describe('Happy path', () => {
    it('returns 200 with entries, total, page and pageSize', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '0.00');

      await deposit(account.id, token, '100.00');
      await deposit(account.id, token, '200.00');

      const res = await get(account.id).set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: 2,
        page: 1,
        pageSize: 20,
        entries: expect.any(Array),
      });
    });

    it('entries have the correct shape without exposing accountId or counterparty data', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '0.00');

      await deposit(account.id, token, '50.00');

      const res = await get(account.id).set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      const entry = res.body.entries[0];

      // Shape requerido por el PRD
      expect(entry).toMatchObject({
        id: expect.any(String),
        amount: '50.00',
        type: 'deposit',
        memo: null,
        createdAt: expect.any(String),
      });

      // Nunca expone datos de la cuenta ni de la contraparte
      expect(entry).not.toHaveProperty('accountId');
      expect(entry).not.toHaveProperty('relatedTransferId');
      expect(entry).not.toHaveProperty('idempotencyKey');
    });

    it('returns entries ordered most-recent-first', async () => {
      const userId = crypto.randomUUID();
      const token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '500.00');

      await deposit(account.id, token, '100.00');
      await deposit(account.id, token, '200.00');
      await deposit(account.id, token, '300.00');

      const res = await get(account.id).set('Cookie', `token=${token}`);

      const amounts = res.body.entries.map((e: { amount: string }) => e.amount);
      // Orden descendente por createdAt: el más reciente (300) primero
      expect(amounts[0]).toBe('300.00');
    });

    it('shows memo for transfer entries and does not expose counterparty accountId', async () => {
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();
      const tokenA = generateToken(userA);
      const accountA = await createAccount(userA, 'USD', '500.00');
      const accountB = await createAccount(userB, 'USD', '0.00');

      await request(app)
        .post('/transfers')
        .set('Cookie', `token=${tokenA}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '100.00',
          memo: 'pago de servicio',
        });

      const res = await get(accountA.id).set('Cookie', `token=${tokenA}`);

      expect(res.status).toBe(200);
      const transferEntry = res.body.entries.find(
        (e: { type: string }) => e.type === 'transfer_out',
      );

      // Memo visible
      expect(transferEntry.memo).toBe('pago de servicio');

      // Nunca expone accountId de la contraparte
      const body = JSON.stringify(res.body);
      expect(body).not.toContain(accountB.id);
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth cookie', async () => {
      const account = await createAccount(crypto.randomUUID());

      const res = await get(account.id);

      expect(res.status).toBe(401);
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
      const res = await get('not-a-uuid').set(
        'Cookie',
        `token=${generateToken(crypto.randomUUID())}`,
      );

      expect(res.status).toBe(400);
    });
  });

  describe('Business rules', () => {
    it('returns 404 for nonexistent account', async () => {
      const res = await get(crypto.randomUUID()).set(
        'Cookie',
        `token=${generateToken(crypto.randomUUID())}`,
      );

      expect(res.status).toBe(404);
    });
  });

  describe('Pagination', () => {
    let userId: string;
    let token: string;
    let accountId: string;

    beforeEach(async () => {
      userId = crypto.randomUUID();
      token = generateToken(userId);
      const account = await createAccount(userId, 'USD', '0.00');
      accountId = account.id;

      // Crear 5 depósitos para probar paginación
      for (let i = 1; i <= 5; i++) {
        await deposit(accountId, token, `${i * 10}.00`);
      }
    });

    it('uses page=1 and pageSize=20 as defaults', async () => {
      const res = await get(accountId).set('Cookie', `token=${token}`);

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(20);
      expect(res.body.total).toBe(5);
    });

    it('respects explicit page and pageSize', async () => {
      const res = await get(accountId, '?page=1&pageSize=2').set(
        'Cookie',
        `token=${token}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(2);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.total).toBe(5);
    });

    it('returns the next page when page=2', async () => {
      const page1 = await get(accountId, '?page=1&pageSize=3').set(
        'Cookie',
        `token=${token}`,
      );
      const page2 = await get(accountId, '?page=2&pageSize=3').set(
        'Cookie',
        `token=${token}`,
      );

      expect(page1.body.entries).toHaveLength(3);
      expect(page2.body.entries).toHaveLength(2);

      // No superposición entre páginas
      const page1Ids = page1.body.entries.map((e: { id: string }) => e.id);
      const page2Ids = page2.body.entries.map((e: { id: string }) => e.id);
      const intersection = page1Ids.filter((id: string) => page2Ids.includes(id));
      expect(intersection).toHaveLength(0);
    });

    it('caps pageSize at 100 when a larger value is requested', async () => {
      const res = await get(accountId, '?page=1&pageSize=500').set(
        'Cookie',
        `token=${token}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.pageSize).toBe(100);
    });
  });
});
