import { prisma } from 'db';
import { deleteClient } from '../../server/src/controllers/client.controller';

jest.mock('db', () => ({
  prisma: {
    client: {
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    activityLog: { create: jest.fn() },
  },
}));

describe('client deletion financial integrity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects deleting a client that owns quotes or invoices', async () => {
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: 'client-1',
      businessId: 'biz-1',
      _count: { quotes: 1, invoices: 0 },
    });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'client-1' },
    };

    await expect(deleteClient(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CLIENT_HAS_FINANCIAL_RECORDS',
    });
    expect(prisma.client.delete).not.toHaveBeenCalled();
  });

  it('allows deleting a client with no financial records', async () => {
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({
      id: 'client-1',
      businessId: 'biz-1',
      _count: { quotes: 0, invoices: 0 },
    });
    (prisma.client.delete as jest.Mock).mockResolvedValue({ id: 'client-1' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'client-1' },
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    await deleteClient(req as never, res as never);

    expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: 'client-1' } });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});
