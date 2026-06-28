import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

// Carrera de idempotencia: múltiples requests idénticas simultáneas
describe('Idempotency race', () => {
  it('processes the operation exactly once despite concurrent identical requests', async () => {
    const userId = crypto.randomUUID();
    const token = generateToken(userId);
    const account = await createAccount(userId, 'USD', '0.00');

    const AMOUNT = '100.00';
    const KEY = 'idem-race-key';
    const NUM_REQUESTS = 10;

    const requests = Array.from({ length: NUM_REQUESTS }, () =>
      request(app)
        .post(`/accounts/${account.id}/deposits`)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', KEY)
        .send({ amount: AMOUNT }),
    );

    const results = await Promise.all(requests);

    // Respuestas válidas: 201 (ganadora o replay) o 409 (operación en curso)
    const successes = results.filter((r) => r.status === 201);
    const conflicts = results.filter((r) => r.status === 409);

    expect(successes.length).toBeGreaterThanOrEqual(1);
    expect(successes.length + conflicts.length).toBe(NUM_REQUESTS);

    // Todas las respuestas exitosas devuelven el mismo resultado
    const firstBody = successes[0].body;
    successes.forEach((r) => expect(r.body).toEqual(firstBody));

    // Solo un ledger entry creado — el efecto ocurrió una sola vez
    const { count } = await db.LedgerEntry.findAndCountAll({
      where: { accountId: account.id },
    });
    expect(count).toBe(1);

    // Balance refleja exactamente un depósito
    const balRes = await request(app)
      .get(`/accounts/${account.id}/balance`)
      .set('Cookie', `token=${token}`);
    expect(balRes.body.balance).toBe(AMOUNT);
  }, 30_000);
});
