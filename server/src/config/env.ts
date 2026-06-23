import { AppError } from '../middlewares/error';

const DEV_JWT_SECRET = 'development-only-jwt-secret';

export const getJwtSecret = (): string => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new AppError('JWT_SECRET must be configured in production', 500);
  }

  return DEV_JWT_SECRET;
};
