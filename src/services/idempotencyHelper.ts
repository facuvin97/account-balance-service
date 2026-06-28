import crypto from 'crypto';
import { UniqueConstraintError } from 'sequelize';
import db from '../database';
import { idempotencyKeyRepository } from '../repositories/idempotencyKeyRepository';
import { AppError, ConflictError } from '../utils/errors';

// Keys en 'processing' más allá de este umbral se consideran abandonadas
const STALE_THRESHOLD_MS = 10_000;

// Hash determinístico de los parámetros del request para detectar reuso con params distintos
export function createFingerprint(...parts: string[]): string {
  return crypto.createHash('sha256').update(parts.join(':')).digest('hex');
}

type ReserveResult =
  | { status: 'reserved'; id: string }
  | { status: 'completed'; responseSnapshot: Record<string, unknown> };

// Intenta reclamar una idempotency key para procesamiento exclusivo
export async function reserveIdempotencyKey(
  userId: string,
  key: string,
  fingerprint: string,
): Promise<ReserveResult> {
  // Caso feliz: primera request con esta key
  try {
    const idemKey = await db.sequelize.transaction(async (t) => {
      return idempotencyKeyRepository.create(
        { userId, key, requestFingerprint: fingerprint, status: 'processing' },
        t,
      );
    });
    return { status: 'reserved', id: idemKey.id };
  } catch (error) {
    if (!(error instanceof UniqueConstraintError)) throw error;
  }

  // Key ya existe — determinar qué hacer
  const existing = await idempotencyKeyRepository.findByUserAndKey(userId, key);
  if (!existing) {
    // Fue borrada entre nuestro INSERT y este SELECT (race condition). Reintentar.
    return reserveIdempotencyKey(userId, key, fingerprint);
  }

  if (existing.requestFingerprint !== fingerprint) {
    throw new ConflictError('Idempotency key already used with different parameters');
  }

  if (existing.status === 'completed') {
    return { status: 'completed', responseSnapshot: existing.responseSnapshot! };
  }

  // status === 'processing' — verificar si está vencida
  const staleThreshold = new Date(Date.now() - STALE_THRESHOLD_MS);

  if (existing.updatedAt >= staleThreshold) {
    throw new ConflictError('Operation already in progress');
  }

  // UPDATE atómico: solo un caller puede reclamar la key vencida
  const reclaimed = await idempotencyKeyRepository.reclaimStale(userId, key, staleThreshold);

  if (reclaimed > 0) {
    return { status: 'reserved', id: existing.id };
  }

  // Otro caller la reclamó o completó — releer para decidir
  const refreshed = await idempotencyKeyRepository.findByUserAndKey(userId, key);
  if (!refreshed) {
    return reserveIdempotencyKey(userId, key, fingerprint);
  }
  if (refreshed.status === 'completed') {
    return { status: 'completed', responseSnapshot: refreshed.responseSnapshot! };
  }

  throw new ConflictError('Operation already in progress');
}

// Devuelve el resultado cacheado, o re-lanza el error de negocio original
export function replaySnapshot(snapshot: Record<string, unknown>): unknown {
  if (snapshot.success === false) {
    throw new AppError(
      snapshot.statusCode as number,
      snapshot.code as string,
      snapshot.message as string,
    );
  }
  return snapshot.data;
}

// Marca key como completada fuera de la transacción principal (para errores de negocio)
export async function markIdempotencyCompleted(
  id: string,
  snapshot: Record<string, unknown>,
): Promise<void> {
  await db.sequelize.transaction(async (t) => {
    await idempotencyKeyRepository.updateResult(id, 'completed', snapshot, t);
  });
}

// Borra la key para que reintentos puedan reclamarla (tras errores de infra)
export async function resetIdempotencyKey(id: string): Promise<void> {
  await idempotencyKeyRepository.deleteById(id);
}
