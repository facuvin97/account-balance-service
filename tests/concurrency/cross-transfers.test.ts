import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

// Transferencias cruzadas A→B y B→A sin deadlock
describe('Cross-transfers without deadlock', () => {
  it('handles parallel A→B and B→A with correct final balances', async () => {
    const userA = crypto.randomUUID();
    const userB = crypto.randomUUID();
    const tokenA = generateToken(userA);
    const tokenB = generateToken(userB);
    const accountA = await createAccount(userA, 'USD', '1000.00');
    const accountB = await createAccount(userB, 'USD', '1000.00');

    const AMOUNT = '10.00';
    const NUM_PAIRS = 10;

    const transfersAB = Array.from({ length: NUM_PAIRS }, (_, i) =>
      request(app)
        .post('/transfers')
        .set('Cookie', `token=${tokenA}`)
        .set('Idempotency-Key', `cross-ab-${i}`)
        .send({
          sourceAccountId: accountA.id,
          destinationAccountId: accountB.id,
          amount: AMOUNT,
        }),
    );

    const transfersBA = Array.from({ length: NUM_PAIRS }, (_, i) =>
      request(app)
        .post('/transfers')
        .set('Cookie', `token=${tokenB}`)
        .set('Idempotency-Key', `cross-ba-${i}`)
        .send({
          sourceAccountId: accountB.id,
          destinationAccountId: accountA.id,
          amount: AMOUNT,
        }),
    );

    const results = await Promise.all([...transfersAB, ...transfersBA]);

    // Ninguna debe fallar por deadlock
    results.forEach((r) => expect(r.status).toBe(201));

    // Efecto neto es cero: ambas cuentas deben mantener su balance original
    const balA = await request(app)
      .get(`/accounts/${accountA.id}/balance`)
      .set('Cookie', `token=${tokenA}`);
    const balB = await request(app)
      .get(`/accounts/${accountB.id}/balance`)
      .set('Cookie', `token=${tokenB}`);

    expect(balA.body.balance).toBe('1000.00');
    expect(balB.body.balance).toBe('1000.00');

    // Cada transferencia genera 2 ledger entries (transfer_out + transfer_in)
    const totalEntries = await db.LedgerEntry.count();
    expect(totalEntries).toBe(NUM_PAIRS * 2 * 2);
  }, 30_000);
});
