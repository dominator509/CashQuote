import { prisma } from 'db';
import { logger } from '../logger/logger.service';

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
  try {
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
  } catch (error) {
    logger.error(
      { err: error, businessId, userId, action, entityId, entityType },
      'Failed to write activity log'
    );
  }
};

export const listActivityLogs = async (
  businessId: string,
  input: { limit: number; cursor?: string }
) => {
  const take = Math.min(Math.max(input.limit, 1), 100);
  const logs = await prisma.activityLog.findMany({
    where: { businessId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const nextCursor = logs.length > take ? logs[take - 1].id : null;
  return {
    items: logs.slice(0, take),
    nextCursor,
  };
};
