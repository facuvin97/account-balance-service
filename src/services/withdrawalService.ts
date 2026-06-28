import Decimal from 'decimal.js';
import db from '../database';
import { accountRepository } from '../repositories/accountRepository';
import { ledgerEntryRepository } from '../repositories/ledgerEntryRepository';
import { idempotencyKeyRepository } from '../repositories/idempotencyKeyRepository';
import { AppError, NotFoundError, ForbiddenError, ConflictError } from '../utils/errors';
import {
  createFingerprint,
  reserveIdempotencyKey,
  markIdempotencyCompleted,
  resetIdempotencyKey,
  replaySnapshot,
} from './idempotencyHelper';

export interface WithdrawalResult {
  balance: string;
  entryId: string;
}

export async function withdraw(
  userId: string,
  accountId: string,
  amount: string,
  idempotencyKey: string,
): Promise<WithdrawalResult> {
  const fingerprint = createFingerprint(accountId, amount, 'withdrawal');
  const reservation = await reserveIdempotencyKey(userId, idempotencyKey, fingerprint);

  if (reservation.status === 'completed') {
    return replaySnapshot(reservation.responseSnapshot) as WithdrawalResult;
  }

  const { id: idemKeyId } = reservation;

  try {
    return await db.sequelize.transaction(async (t) => {
      const account = await accountRepository.findByIdForUpdate(accountId, t);
      if (!account) throw new NotFoundError('Account not found');
      if (account.userId !== userId) throw new ForbiddenError('Account does not belong to user');

      const currentBalance = new Decimal(account.cachedBalance);
      const withdrawAmount = new Decimal(amount);

      // Sin retiro parcial — se rechaza completo si no alcanza
      if (currentBalance.lt(withdrawAmount)) {
        throw new ConflictError('Insufficient funds');
      }

      const newBalance = currentBalance.minus(withdrawAmount).toFixed(2);

      const entry = await ledgerEntryRepository.create(
        { accountId, amount, type: 'withdrawal', idempotencyKey },
        t,
      );

      await accountRepository.updateCachedBalance(accountId, newBalance, t);

      const result: WithdrawalResult = { balance: newBalance, entryId: entry.id };
      await idempotencyKeyRepository.updateResult(
        idemKeyId,
        'completed',
        { success: true, data: result },
        t,
      );

      return result;
    });
  } catch (error) {
    if (error instanceof AppError) {
      try {
        await markIdempotencyCompleted(idemKeyId, {
          success: false,
          statusCode: error.statusCode,
          code: error.code,
          message: error.message,
        });
      } catch {
        // Best-effort; el TTL reclama la key si esto falla
      }
    } else {
      try {
        await resetIdempotencyKey(idemKeyId);
      } catch {
        // El TTL reclama keys 'processing' vencidas como red de seguridad
      }
    }
    throw error;
  }
}
