import { prisma } from 'db';
import { convertQuoteToInvoice } from '../../server/src/services/billing/conversion.service';

jest.mock('db', () => ({
  prisma: {
    quote: { findFirst: jest.fn() },
    activityLog: { create: jest.fn() },
    invoice: { create: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma))
  }
}));

describe('Phase 4: Internal Security & Exception Handling Validation', () => {
  const businessId = 'biz-1';
  const quoteId = 'quote-1';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should gracefully bubble up internal database connection errors inside the transaction', async () => {
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
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null);

    // Force an internal panic on creation
    const dbError = new Error('Database connection reset by peer');
    (prisma.invoice.create as jest.Mock).mockRejectedValue(dbError);

    await expect(convertQuoteToInvoice(quoteId, businessId)).rejects.toThrow('Database connection reset by peer');
  });
});
