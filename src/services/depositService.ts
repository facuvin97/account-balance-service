import Decimal from 'decimal.js';
import db from '../database';
import { accountRepository } from '../repositories/accountRepository';
import { ledgerEntryRepository } from '../repositories/ledgerEntryRepository';
import { idempotencyKeyRepository } from '../repositories/idempotencyKeyRepository';
import { AppError, NotFoundError, ForbiddenError } from '../utils/errors';
import {
  createFingerprint,
  reserveIdempotencyKey,
  markIdempotencyCompleted,
  resetIdempotencyKey,
  replaySnapshot,
} from './idempotencyHelper';

export interface DepositResult {
  balance: string;
  entryId: string;
}

export async function deposit(
  userId: string,
  accountId: string,
  amount: string,
  idempotencyKey: string,
): Promise<DepositResult> {
  const fingerprint = createFingerprint(accountId, amount, 'deposit');
  const reservation = await reserveIdempotencyKey(userId, idempotencyKey, fingerprint);

  // Replay idempotente: devolver resultado cacheado sin reprocesar
  if (reservation.status === 'completed') {
    return replaySnapshot(reservation.responseSnapshot) as DepositResult;
  }

  const { id: idemKeyId } = reservation;

  try {
    // READ COMMITTED + SELECT FOR UPDATE: serialización por row-lock, no por isolation level
    return await db.sequelize.transaction(async (t) => {
      // Lock pesimista — serializa todas las operaciones sobre esta cuenta
      const account = await accountRepository.findByIdForUpdate(accountId, t);
      if (!account) throw new NotFoundError('Account not found');
      if (account.userId !== userId) throw new ForbiddenError('Account does not belong to user');

      const newBalance = new Decimal(account.cachedBalance).plus(amount).toFixed(2);

      // amount siempre positivo; la dirección la determina el type
      const entry = await ledgerEntryRepository.create(
        { accountId, amount, type: 'deposit', idempotencyKey },
        t,
      );

      await accountRepository.updateCachedBalance(accountId, newBalance, t);

      // Snapshot dentro de la misma transacción: se revierte junto si falla el commit
      const result: DepositResult = { balance: newBalance, entryId: entry.id };
      await idempotencyKeyRepository.updateResult(
        idemKeyId,
        'completed',
        { success: true, data: result },
        t,
      );

      return result;
    });
  } catch (error) {
    // Error de negocio (determinístico) → cachear para que replays devuelvan el mismo rechazo
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
      // Error de infra → borrar key para que el cliente pueda reintentar
      try {
        await resetIdempotencyKey(idemKeyId);
      } catch {
        // El TTL reclama keys 'processing' vencidas como red de seguridad
      }
    }
    throw error;
  }
}
