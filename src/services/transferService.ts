import Decimal from 'decimal.js';
import db from '../database';
import { accountRepository } from '../repositories/accountRepository';
import { ledgerEntryRepository } from '../repositories/ledgerEntryRepository';
import { transferRepository } from '../repositories/transferRepository';
import { idempotencyKeyRepository } from '../repositories/idempotencyKeyRepository';
import {
  AppError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../utils/errors';
import {
  createFingerprint,
  reserveIdempotencyKey,
  markIdempotencyCompleted,
  resetIdempotencyKey,
  replaySnapshot,
} from './idempotencyHelper';

export interface TransferResult {
  transferId: string;
  balance: string;
}

export async function transfer(
  userId: string,
  sourceAccountId: string,
  destinationAccountId: string,
  amount: string,
  memo: string | null,
  idempotencyKey: string,
): Promise<TransferResult> {
  if (sourceAccountId === destinationAccountId) {
    throw new ValidationError('Cannot transfer to the same account');
  }

  const fingerprint = createFingerprint(
    sourceAccountId,
    destinationAccountId,
    amount,
    memo ?? '',
    'transfer',
  );
  const reservation = await reserveIdempotencyKey(userId, idempotencyKey, fingerprint);

  // Replay idempotente: devolver resultado cacheado sin reprocesar
  if (reservation.status === 'completed') {
    return replaySnapshot(reservation.responseSnapshot) as TransferResult;
  }

  const { id: idemKeyId } = reservation;

  try {
    return await db.sequelize.transaction(async (t) => {
      // Orden determinístico de lock por id ascendente para evitar deadlocks
      const [firstId, secondId] =
        sourceAccountId < destinationAccountId
          ? [sourceAccountId, destinationAccountId]
          : [destinationAccountId, sourceAccountId];

      const first = await accountRepository.findByIdForUpdate(firstId, t);
      const second = await accountRepository.findByIdForUpdate(secondId, t);

      const source = firstId === sourceAccountId ? first : second;
      const destination = firstId === sourceAccountId ? second : first;

      if (!source) throw new NotFoundError('Source account not found');
      if (!destination) throw new NotFoundError('Destination account not found');

      if (source.userId !== userId) {
        throw new ForbiddenError('Source account does not belong to user');
      }

      if (source.currency !== destination.currency) {
        throw new ValidationError('Accounts must be in the same currency');
      }

      const sourceBalance = new Decimal(source.cachedBalance);
      const transferAmount = new Decimal(amount);

      // Sin transferencia parcial — se rechaza completo si no alcanza
      if (sourceBalance.lt(transferAmount)) {
        throw new ConflictError('Insufficient funds');
      }

      const newSourceBalance = sourceBalance.minus(transferAmount).toFixed(2);
      const newDestBalance = new Decimal(destination.cachedBalance).plus(transferAmount).toFixed(2);

      const transferRecord = await transferRepository.create(
        { sourceAccountId, destinationAccountId, amount, memo },
        t,
      );

      // Partida doble: débito en origen, crédito en destino
      await ledgerEntryRepository.create(
        {
          accountId: sourceAccountId,
          amount,
          type: 'transfer_out',
          relatedTransferId: transferRecord.id,
          idempotencyKey,
        },
        t,
      );

      await ledgerEntryRepository.create(
        {
          accountId: destinationAccountId,
          amount,
          type: 'transfer_in',
          relatedTransferId: transferRecord.id,
          idempotencyKey,
        },
        t,
      );

      await accountRepository.updateCachedBalance(sourceAccountId, newSourceBalance, t);
      await accountRepository.updateCachedBalance(destinationAccountId, newDestBalance, t);

      // Solo exponer balance del usuario autenticado, nunca el de la contraparte
      const result: TransferResult = {
        transferId: transferRecord.id,
        balance: newSourceBalance,
      };

      // Snapshot dentro de la misma transacción: se revierte junto si falla el commit
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
