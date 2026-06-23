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

  if (!req.user?.id) {
    throw new AppError('Unauthorized: Missing user context', 401);
  }

  const membership = await prisma.businessMember.findUnique({
    where: {
      userId_businessId: {
        userId: req.user.id,
        businessId,
      },
    },
    include: { business: true },
  });

  if (!membership) {
    throw new AppError('Forbidden: User does not have access to this business', 403);
  }

  req.business = { id: membership.business.id };
  next();
};
