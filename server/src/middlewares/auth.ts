import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error';
import { getJwtSecret } from '../config/env';
import type { BusinessRole } from './tenant';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role?: BusinessRole;
      };
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  const token = req.cookies.token;

  if (!token) {
    throw new AppError('Unauthorized: No token provided', 401, 'AUTH_REQUIRED');
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof decoded.userId !== 'string' ||
      decoded.userId.trim() === ''
    ) {
      throw new Error('Invalid token payload');
    }

    req.user = { id: decoded.userId };
    next();
  } catch {
    throw new AppError('Unauthorized: Invalid token', 401, 'AUTH_INVALID');
  }
};
