import { prisma } from 'db';
import { updateQuote } from '../../server/src/controllers/quote.controller';

jest.mock('db', () => ({
  prisma: {
    quote: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    quoteLineItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}));

describe('quote update financial integrity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects updates to quotes that have already been converted to invoices', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      businessId: 'biz-1',
      subtotal: 1000,
      tax: 0,
      discount: 0,
      lineItems: [{ description: 'Service', quantity: 1, price: 1000 }],
      _count: { sourceInvoices: 1 },
    });

    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'quote-1' },
      body: { status: 'sent' },
    };

    await expect(updateQuote(req as never, { json: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'QUOTE_HAS_INVOICE',
      message: 'Quote has already been converted to an invoice and cannot be updated',
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' }
    );
    expect(prisma.quoteLineItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.quote.update).not.toHaveBeenCalled();
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });
});
