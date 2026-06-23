import { prisma } from 'db';

interface ActivityInput {
  businessId: string;
  action: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  details?: string;
}

export const logActivity = async ({
  businessId,
  action,
  userId,
  entityId,
  entityType,
  details,
}: ActivityInput): Promise<void> => {
  await prisma.activityLog.create({
    data: {
      businessId,
      action,
      userId,
      entityId,
      entityType,
      details,
    },
  });
};
