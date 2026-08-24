import { prisma } from 'db';
import { logActivity } from '../../server/src/services/activity/activity.service';
import { logger } from '../../server/src/services/logger/logger.service';

jest.mock('db', () => ({
  prisma: {
    activityLog: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../server/src/services/logger/logger.service', () => ({
  logger: {
    error: jest.fn(),
  },
}));

describe('activity logging resilience', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('does not throw when a best-effort activity log write fails after a mutation', async () => {
    const error = new Error('activity table unavailable');
    (prisma.activityLog.create as jest.Mock).mockRejectedValue(error);

    await expect(
      logActivity({
        businessId: 'biz-1',
        userId: 'user-1',
        action: 'client_create',
        entityId: 'client-1',
        entityType: 'client',
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      {
        err: error,
        businessId: 'biz-1',
        userId: 'user-1',
        action: 'client_create',
        entityId: 'client-1',
        entityType: 'client',
      },
      'Failed to write activity log'
    );
  });
});
