import { prisma } from 'db';
import { updateInvoice } from '../../server/src/controllers/invoice.controller';
import { updateQuote } from '../../server/src/controllers/quote.controller';

jest.mock('db', () => ({
  prisma: {
    quote: { findFirst: jest.fn(), update: jest.fn() },
    quoteLineItem: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    invoice: { findFirst: jest.fn(), update: jest.fn() },
    invoiceLineItem: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  },
}));

describe('tax-rate update integrity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects quote financial changes without an explicit tax rate', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      businessId: 'biz-1',
      subtotal: 1001,
      tax: 83,
      discount: 0,
      total: 1084,
      lineItems: [{ description: 'Original work', quantity: 1, price: 1001 }],
      _count: { sourceInvoices: 0 },
    });

    const request = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'quote-1' },
      body: {
        lineItems: [{ description: 'Expanded work', quantity: 1, price: 2001 }],
      },
    };

    await expect(updateQuote(request as never, { json: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 400,
      code: 'TAX_RATE_REQUIRED',
    });
    expect(prisma.quoteLineItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.quote.update).not.toHaveBeenCalled();
  });

  it('rejects invoice financial changes without an explicit tax rate', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      businessId: 'biz-1',
      status: 'unpaid',
      subtotal: 1001,
      tax: 83,
      discount: 0,
      total: 1084,
      lineItems: [{ description: 'Original work', quantity: 1, price: 1001 }],
      payments: [],
    });

    const request = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: 'invoice-1' },
      body: {
        lineItems: [{ description: 'Expanded work', quantity: 1, price: 2001 }],
      },
    };

    await expect(updateInvoice(request as never, { json: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 400,
      code: 'TAX_RATE_REQUIRED',
    });
    expect(prisma.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('preserves quote financial totals for status-only updates', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      businessId: 'biz-1',
      subtotal: 1001,
      tax: 83,
      discount: 0,
      total: 1084,
      lineItems: [{ description: 'Original work', quantity: 1, price: 1001 }],
      _count: { sourceInvoices: 0 },
    });
    (prisma.quote.update as jest.Mock).mockResolvedValue({ id: 'quote-1' });

    await updateQuote(
      {
        business: { id: 'biz-1' },
        user: { id: 'user-1' },
        params: { id: 'quote-1' },
        body: { status: 'sent' },
      } as never,
      { json: jest.fn() } as never
    );

    expect(prisma.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'sent' } })
    );
  });

  it('preserves invoice financial totals for status and due-date-only updates', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'invoice-1',
      businessId: 'biz-1',
      status: 'unpaid',
      subtotal: 1001,
      tax: 83,
      discount: 0,
      total: 1084,
      lineItems: [{ description: 'Original work', quantity: 1, price: 1001 }],
      payments: [],
    });
    (prisma.invoice.update as jest.Mock).mockResolvedValue({ id: 'invoice-1' });
    const dueDate = '2026-09-01T00:00:00.000Z';

    await updateInvoice(
      {
        business: { id: 'biz-1' },
        user: { id: 'user-1' },
        params: { id: 'invoice-1' },
        body: { status: 'unpaid', dueDate },
      } as never,
      { json: jest.fn() } as never
    );

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'unpaid', dueDate: new Date(dueDate) },
      })
    );
  });
});
