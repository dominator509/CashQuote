import { prisma } from 'db';
import { deleteQuote } from '../../server/src/controllers/quote.controller';

jest.mock('db', () => ({
  prisma: {
    quote: {
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    reminder: { findFirst: jest.fn() },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}));

describe('quote deletion financial integrity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects deleting a quote that has already been converted to an invoice', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      businessId: 'biz-1',
      _count: { sourceInvoices: 1 },
    });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'quote-1' },
    };

    await expect(deleteQuote(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'QUOTE_HAS_INVOICE',
    });
    expect(prisma.quote.delete).not.toHaveBeenCalled();
  });

  it('allows deleting an unconverted quote', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      businessId: 'biz-1',
      _count: { sourceInvoices: 0 },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.quote.delete as jest.Mock).mockResolvedValue({ id: 'quote-1' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'quote-1' },
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };

    await deleteQuote(req as never, res as never);

    expect(prisma.quote.delete).toHaveBeenCalledWith({ where: { id: 'quote-1' } });
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it('rejects deleting a quote with active reminders', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      businessId: 'biz-1',
      _count: { sourceInvoices: 0 },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({ id: 'rem-1', status: 'pending' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'quote-1' },
    };

    await expect(deleteQuote(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'QUOTE_HAS_ACTIVE_REMINDERS',
    });
    expect(prisma.reminder.findFirst).toHaveBeenCalledWith({
      where: {
        businessId: 'biz-1',
        entityId: 'quote-1',
        entityType: 'quote',
        status: { in: ['pending', 'sending', 'sent'] },
      },
    });
    expect(prisma.quote.delete).not.toHaveBeenCalled();
  });
});
