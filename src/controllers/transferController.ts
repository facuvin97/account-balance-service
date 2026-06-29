import { Request, Response, NextFunction } from 'express';
import { transfer } from '../services/transferService';
import { ValidationError } from '../utils/errors';

export async function transferController(req: Request, res: Response, next: NextFunction) {
  try {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) throw new ValidationError('Idempotency-Key header is required');
    if (idempotencyKey.length > 255) throw new ValidationError('Idempotency-Key must be at most 255 characters');

    const { sourceAccountId, destinationAccountId, amount, memo } = req.body;
    const result = await transfer(
      req.userId!,
      sourceAccountId,
      destinationAccountId,
      amount,
      memo,
      idempotencyKey,
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}
