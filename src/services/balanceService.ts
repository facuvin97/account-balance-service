import { accountRepository } from '../repositories/accountRepository';
import { NotFoundError, ForbiddenError } from '../utils/errors';

export interface BalanceResult {
  accountId: string;
  currency: string;
  balance: string;
}

// Lectura directa del cached_balance — sin lock ni transacción (solo lectura)
export async function getBalance(userId: string, accountId: string): Promise<BalanceResult> {
  const account = await accountRepository.findById(accountId);
  if (!account) throw new NotFoundError('Account not found');
  if (account.userId !== userId) throw new ForbiddenError('Account does not belong to user');

  return {
    accountId: account.id,
    currency: account.currency,
    balance: account.cachedBalance,
  };
}
