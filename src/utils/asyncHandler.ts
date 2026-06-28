import { Request, Response, NextFunction, RequestHandler } from 'express';

// Envuelve controladores async para que Express no reciba una Promise
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler => (req, res, next) => {
  fn(req, res, next).catch(next);
};
