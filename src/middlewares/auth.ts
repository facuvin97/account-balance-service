import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';

interface JwtPayload {
  userId: string;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const token = (req.cookies as Record<string, string> | undefined)?.token;

  if (!token) {
    throw new UnauthorizedError('Missing authentication token');
  }

  try {
    // Pin explícito a HS256 — previene algorithm confusion attacks (alg:none, RS256 con clave pública)
    const payload = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ['HS256'],
    }) as JwtPayload;
    // Validación runtime del claim — el cast de TS no garantiza el tipo en producción
    if (typeof payload.userId !== 'string') {
      throw new Error('invalid payload');
    }
    req.userId = payload.userId;
    next();
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
