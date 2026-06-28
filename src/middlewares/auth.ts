import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';

interface JwtPayload {
  userId: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token: string | undefined = req.cookies?.token;

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.userId = payload.userId;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
