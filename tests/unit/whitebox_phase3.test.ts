import { prisma } from 'db';
import { convertQuoteToInvoice } from '../../server/src/services/billing/conversion.service';

jest.mock('db', () => ({
  prisma: {
    quote: { findFirst: jest.fn() },
    activityLog: { findFirst: jest.fn(), create: jest.fn() },
    invoice: { create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma))
  }
}));

describe('Phase 3: Exhaustive Path & Branch Coverage', () => {
  const businessId = 'biz-1';
  const quoteId = 'quote-1';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('Path 1: Quote not found should throw 404', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(convertQuoteToInvoice(quoteId, businessId)).rejects.toMatchObject({
      statusCode: 404,
      message: 'Quote not found'
    });
  });

  it('Path 2: Quote status not accepted should throw 400', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({ id: quoteId, status: 'draft' });

    await expect(convertQuoteToInvoice(quoteId, businessId)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Only accepted quotes can be converted into invoices'
    });
  });

  it('Path 3: Idempotency conflict should throw 409', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({ id: quoteId, status: 'accepted' });
    (prisma.activityLog.findFirst as jest.Mock).mockResolvedValue({ id: 'log-1' });

    await expect(convertQuoteToInvoice(quoteId, businessId)).rejects.toMatchObject({
      statusCode: 409,
      message: 'Quote has already been converted to an invoice'
    });
  });

  it('Path 4: Successful conversion', async () => {
    const mockQuote = {
      id: quoteId,
      clientId: 'client-1',
      businessId,
      status: 'accepted',
      subtotal: 100,
      tax: 10,
      discount: 0,
      total: 110,
      lineItems: [{ description: 'Item 1', quantity: 1, price: 100, category: 'service' }]
    };

    (prisma.quote.findFirst as jest.Mock).mockResolvedValue(mockQuote);
    (prisma.activityLog.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1' });
    (prisma.activityLog.create as jest.Mock).mockResolvedValue({ id: 'log-2' });

    const result = await convertQuoteToInvoice(quoteId, businessId);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.invoice.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ subtotal: 100, total: 110 })
    }));
    expect(prisma.activityLog.create).toHaveBeenCalled();
    expect(result).toEqual({ id: 'inv-1' });
  });
});
