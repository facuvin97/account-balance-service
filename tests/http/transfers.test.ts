import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

const post = () => request(app).post('/transfers');

describe('POST /transfers', () => {
  describe('Happy path', () => {
    it('returns 201 with transferId and source balance; updates both accounts and creates 2 ledger entries', async () => {
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();
      const tokenA = generateToken(userA);
      const accountA = await createAccount(userA, 'USD', '500.00');
      const accountB = await createAccount(userB, 'USD', '100.00');

      const res = await post()
        .set('Cookie', `token=${tokenA}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '150.00',
          memo: 'alquiler mayo',
        });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        transferId: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        balance: '350.00',
      });

      // Respuesta NO expone balance de la contraparte
      expect(res.body).not.toHaveProperty('destinationBalance');
      expect(res.body).not.toHaveProperty('counterparty');

      // Ambos balances actualizados
      const updatedA = await db.Account.findByPk(accountA.id);
      const updatedB = await db.Account.findByPk(accountB.id);
      expect(updatedA!.cachedBalance).toBe('350.00');
      expect(updatedB!.cachedBalance).toBe('250.00');

      // Dos ledger entries ligados al transfer
      const entries = await db.LedgerEntry.findAll({
        where: { relatedTransferId: res.body.transferId },
      });
      expect(entries).toHaveLength(2);

      const types = entries.map((e) => e.type).sort();
      expect(types).toEqual(['transfer_in', 'transfer_out']);
    });

    it('works without memo (optional field)', async () => {
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();
      const accountA = await createAccount(userA, 'USD', '200.00');
      const accountB = await createAccount(userB, 'USD', '0.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '50.00',
        });

      expect(res.status).toBe(201);
    });
  });

  describe('Auth', () => {
    it('returns 401 without auth cookie', async () => {
      const accountA = await createAccount(crypto.randomUUID(), 'USD', '200.00');
      const accountB = await createAccount(crypto.randomUUID(), 'USD', '0.00');

      const res = await post()
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '50.00',
        });

      expect(res.status).toBe(401);
    });

    it('returns 403 when source account belongs to a different user', async () => {
      const owner = crypto.randomUUID();
      const attacker = crypto.randomUUID();
      const accountA = await createAccount(owner, 'USD', '500.00');
      const accountB = await createAccount(attacker, 'USD', '0.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(attacker)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '100.00',
        });

      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: { code: 'FORBIDDEN' } });
    });
  });

  describe('Input validation', () => {
    let userA: string;
    let tokenA: string;
    let accountAId: string;
    let accountBId: string;

    beforeEach(async () => {
      userA = crypto.randomUUID();
      tokenA = generateToken(userA);
      accountAId = (await createAccount(userA, 'USD', '1000.00')).id;
      accountBId = (await createAccount(crypto.randomUUID(), 'USD', '0.00')).id;
    });

    it.each([
      ['negativo', '-10.00'],
      ['cero', '0'],
      ['más de 2 decimales', '5.555'],
      ['no numérico', 'bad'],
    ])('returns 400 for amount %s', async (_, amount) => {
      const res = await post()
        .set('Cookie', `token=${tokenA}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ sourceAccountId: accountAId, destinationAccountId: accountBId, amount });

      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    });

    it('returns 400 when sourceAccountId is not a valid UUID', async () => {
      const res = await post()
        .set('Cookie', `token=${tokenA}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ sourceAccountId: 'not-uuid', destinationAccountId: accountBId, amount: '50.00' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when destinationAccountId is not a valid UUID', async () => {
      const res = await post()
        .set('Cookie', `token=${tokenA}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({ sourceAccountId: accountAId, destinationAccountId: 'not-uuid', amount: '50.00' });

      expect(res.status).toBe(400);
    });

    it('returns 400 when Idempotency-Key header is missing', async () => {
      const res = await post()
        .set('Cookie', `token=${tokenA}`)
        .send({ sourceAccountId: accountAId, destinationAccountId: accountBId, amount: '50.00' });

      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/idempotency/i);
    });
  });

  describe('Business rules', () => {
    it('returns 400 for self-transfer (same source and destination)', async () => {
      const userId = crypto.randomUUID();
      const account = await createAccount(userId, 'USD', '500.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(userId)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: account.id,
          destinationAccountId: account.id,
          amount: '100.00',
        });

      expect(res.status).toBe(400);
    });

    it('returns 404 when source account does not exist', async () => {
      const userId = crypto.randomUUID();
      const accountB = await createAccount(crypto.randomUUID(), 'USD', '0.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(userId)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: crypto.randomUUID(),
          destinationAccountId: accountB.id,
          amount: '50.00',
        });

      expect(res.status).toBe(404);
    });

    it('returns 404 when destination account does not exist', async () => {
      const userId = crypto.randomUUID();
      const accountA = await createAccount(userId, 'USD', '500.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(userId)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: crypto.randomUUID(),
          amount: '50.00',
        });

      expect(res.status).toBe(404);
    });

    it('returns 409 for insufficient funds and leaves both balances unchanged', async () => {
      const userA = crypto.randomUUID();
      const userB = crypto.randomUUID();
      const accountA = await createAccount(userA, 'USD', '50.00');
      const accountB = await createAccount(userB, 'USD', '200.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '999.00',
        });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ error: { code: 'CONFLICT' } });

      // Ambos balances sin cambios
      const updatedA = await db.Account.findByPk(accountA.id);
      const updatedB = await db.Account.findByPk(accountB.id);
      expect(updatedA!.cachedBalance).toBe('50.00');
      expect(updatedB!.cachedBalance).toBe('200.00');

      // Sin ledger entries creados
      const totalEntries = await db.LedgerEntry.count();
      expect(totalEntries).toBe(0);
    });

    it('returns 400 when accounts are in different currencies', async () => {
      const userA = crypto.randomUUID();
      const accountA = await createAccount(userA, 'USD', '500.00');
      const accountB = await createAccount(crypto.randomUUID(), 'EUR', '0.00');

      const res = await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', crypto.randomUUID())
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '100.00',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('Idempotency', () => {
    it('returns identical response on replay without duplicating the transfer', async () => {
      const userA = crypto.randomUUID();
      const accountA = await createAccount(userA, 'USD', '500.00');
      const accountB = await createAccount(crypto.randomUUID(), 'USD', '0.00');
      const idemKey = crypto.randomUUID();
      const body = {
        sourceAccountId: accountA.id,
        destinationAccountId: accountB.id,
        amount: '100.00',
        memo: 'pago',
      };

      const first = await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', idemKey)
        .send(body);

      const second = await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', idemKey)
        .send(body);

      expect(first.status).toBe(201);
      expect(second.status).toBe(201);
      expect(second.body).toEqual(first.body);

      // Solo 2 ledger entries (un solo transfer)
      const totalEntries = await db.LedgerEntry.count();
      expect(totalEntries).toBe(2);
    });

    it('returns 409 when key is reused with different amount', async () => {
      const userA = crypto.randomUUID();
      const accountA = await createAccount(userA, 'USD', '500.00');
      const accountB = await createAccount(crypto.randomUUID(), 'USD', '0.00');
      const idemKey = crypto.randomUUID();

      await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', idemKey)
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '100.00',
        });

      const res = await post()
        .set('Cookie', `token=${generateToken(userA)}`)
        .set('Idempotency-Key', idemKey)
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: '200.00',
        });

      expect(res.status).toBe(409);
    });
  });
});
