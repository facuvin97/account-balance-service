import '../helpers/setup';
import crypto from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import db from '../../src/database';
import { generateToken } from '../helpers/auth';
import { createAccount } from '../helpers/createAccount';

// Depósitos y retiros concurrentes sobre la misma cuenta
describe('Concurrent deposits and withdrawals', () => {
  it('produces the exact expected balance without lost updates', async () => {
    const userId = crypto.randomUUID();
    const token = generateToken(userId);
    const account = await createAccount(userId, 'USD', '1000.00');

    const NUM_DEPOSITS = 10;
    const NUM_WITHDRAWALS = 5;
    const DEPOSIT_AMOUNT = '100.00';
    const WITHDRAWAL_AMOUNT = '50.00';

    // Balance esperado: 1000 + 10×100 − 5×50 = 1750
    const expectedBalance = '1750.00';

    const deposits = Array.from({ length: NUM_DEPOSITS }, (_, i) =>
      request(app)
        .post(`/accounts/${account.id}/deposits`)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', `conc-dep-${i}`)
        .send({ amount: DEPOSIT_AMOUNT }),
    );

    const withdrawals = Array.from({ length: NUM_WITHDRAWALS }, (_, i) =>
      request(app)
        .post(`/accounts/${account.id}/withdrawals`)
        .set('Cookie', `token=${token}`)
        .set('Idempotency-Key', `conc-wd-${i}`)
        .send({ amount: WITHDRAWAL_AMOUNT }),
    );

    const results = await Promise.all([...deposits, ...withdrawals]);

    // Todas deben completarse con 201
    results.forEach((r) => expect(r.status).toBe(201));

    // Balance final exacto — un lost update dejaría un número distinto
    const balanceRes = await request(app)
      .get(`/accounts/${account.id}/balance`)
      .set('Cookie', `token=${token}`);

    expect(balanceRes.body.balance).toBe(expectedBalance);

    // Cantidad exacta de ledger entries
    const { count } = await db.LedgerEntry.findAndCountAll({
      where: { accountId: account.id },
    });
    expect(count).toBe(NUM_DEPOSITS + NUM_WITHDRAWALS);
  }, 30_000);
});
