import { Request, Response, NextFunction } from 'express';
import { deposit } from '../services/depositService';
import { withdraw } from '../services/withdrawalService';
import { getBalance } from '../services/balanceService';
import { getHistory } from '../services/historyService';
import { ValidationError } from '../utils/errors';

export async function depositController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) throw new ValidationError('Idempotency-Key header is required');
    if (idempotencyKey.length > 255)
      throw new ValidationError('Idempotency-Key must be at most 255 characters');

    const { amount } = req.body as { amount: string };
    const result = await deposit(req.userId!, req.params.accountId, amount, idempotencyKey);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function withdrawalController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) throw new ValidationError('Idempotency-Key header is required');
    if (idempotencyKey.length > 255)
      throw new ValidationError('Idempotency-Key must be at most 255 characters');

    const { amount } = req.body as { amount: string };
    const result = await withdraw(req.userId!, req.params.accountId, amount, idempotencyKey);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function balanceController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await getBalance(req.userId!, req.params.accountId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

export async function ledgerEntriesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const result = await getHistory(req.userId!, req.params.accountId, page, pageSize);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
