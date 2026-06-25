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

export const listActivityLogs = async (
  businessId: string,
  input: { limit: number; cursor?: string }
) => {
  const take = Math.min(Math.max(input.limit, 1), 100);
  const logs = await prisma.activityLog.findMany({
    where: { businessId },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
  });

  const nextCursor = logs.length > take ? logs[take].id : null;
  return {
    items: logs.slice(0, take),
    nextCursor,
  };
};
