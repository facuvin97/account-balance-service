import db from '../../src/database';

// Crea una cuenta en la DB de test
export async function createAccount(userId: string, currency = 'USD', cachedBalance = '0.00') {
  return db.Account.create({ userId, currency, cachedBalance });
}
