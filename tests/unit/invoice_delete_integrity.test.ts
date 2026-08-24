import { prisma } from 'db';
import { deleteInvoice } from '../../server/src/controllers/invoice.controller';

jest.mock('db', () => ({
  prisma: {
    invoice: {
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    reminder: { findFirst: jest.fn() },
    activityLog: { create: jest.fn() },
  },
}));

describe('invoice deletion payment integrity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects deleting an invoice that has recorded payments', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      businessId: 'biz-1',
      _count: { payments: 1 },
    });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'inv-1' },
    };

    await expect(deleteInvoice(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVOICE_HAS_PAYMENTS',
    });
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an invoice with no recorded payments', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      businessId: 'biz-1',
      _count: { payments: 0 },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.invoice.delete as jest.Mock).mockResolvedValue({ id: 'inv-1' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'inv-1' },
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    await deleteInvoice(req as never, res as never);

    expect(prisma.invoice.delete).toHaveBeenCalledWith({ where: { id: 'inv-1' } });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('rejects deleting an invoice with active reminders', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      businessId: 'biz-1',
      _count: { payments: 0 },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({ id: 'rem-1', status: 'sent' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'inv-1' },
    };

    await expect(deleteInvoice(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVOICE_HAS_ACTIVE_REMINDERS',
    });
    expect(prisma.reminder.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        entityId: 'inv-1',
        entityType: 'invoice',
        status: { in: ['pending', 'sent'] },
      },
    });
    expect(prisma.invoice.delete).not.toHaveBeenCalled();
  });
});
