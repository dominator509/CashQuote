import { prisma } from 'db';
import { listActivityLogs } from '../../server/src/services/activity/activity.service';

jest.mock('db', () => ({
  prisma: {
    activityLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));

describe('activity log pagination', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns the last visible item as nextCursor so the next page does not skip unseen logs', async () => {
    const firstPage = [
      { id: 'log-1', action: 'client_create' },
      { id: 'log-2', action: 'quote_create' },
      { id: 'log-3', action: 'invoice_create' },
    ];
    (prisma.activityLog.findMany as jest.Mock).mockResolvedValueOnce(firstPage);

    const result = await listActivityLogs('biz-1', { limit: 2 });

    expect(result.items).toEqual(firstPage.slice(0, 2));
    expect(result.nextCursor).toBe('log-2');
    expect(prisma.activityLog.findMany).toHaveBeenCalledWith({
      where: { businessId: 'biz-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    });

    (prisma.activityLog.findMany as jest.Mock).mockResolvedValueOnce([
      { id: 'log-3', action: 'invoice_create' },
    ]);

    await listActivityLogs('biz-1', { limit: 2, cursor: result.nextCursor ?? undefined });

    expect(prisma.activityLog.findMany).toHaveBeenLastCalledWith({
      where: { businessId: 'biz-1' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
      cursor: { id: 'log-2' },
      skip: 1,
    });
  });

  it('uses a deterministic secondary id sort for logs created at the same time', async () => {
    (prisma.activityLog.findMany as jest.Mock).mockResolvedValueOnce([]);

    await listActivityLogs('biz-1', { limit: 50 });

    expect(prisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      })
    );
  });
});
