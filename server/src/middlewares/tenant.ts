import { Request, Response, NextFunction } from 'express';
import { prisma } from 'db';
import { AppError } from './error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      business?: {
        id: string;
      };
    }
  }
}

export const requireBusinessId = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const businessId = req.headers['x-business-id'] as string;

  if (!businessId) {
    throw new AppError('Bad Request: Missing x-business-id header', 400);
  }

  // In a real multi-tenant app, we would verify that req.user.id has access to businessId.
  // For Phase 3 demo/MVP logic, we just verify the business exists to enforce the guardrail.
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError('Forbidden: Invalid business ID', 403);
  }

  req.business = { id: business.id };
  next();
};
