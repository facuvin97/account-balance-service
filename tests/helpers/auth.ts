import jwt from 'jsonwebtoken';

// Genera token JWT válido para tests
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '1h' });
}
