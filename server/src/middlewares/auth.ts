import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error';
import { getJwtSecret } from '../config/env';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies.token;

  if (!token) {
    throw new AppError('Unauthorized: No token provided', 401);
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as { userId: string };
    req.user = { id: decoded.userId };
    next();
  } catch {
    throw new AppError('Unauthorized: Invalid token', 401);
  }
};
