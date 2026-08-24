import { prisma } from 'db';
import { createInvoice, updateInvoice } from '../../server/src/controllers/invoice.controller';
import { createQuote, updateQuote } from '../../server/src/controllers/quote.controller';

jest.mock('db', () => ({
  prisma: {
    client: { findFirst: jest.fn() },
    quote: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    quoteLineItem: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    invoice: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    invoiceLineItem: { deleteMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn() },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}));

describe('financial discount integrity', () => {
  const clientId = '11111111-1111-4111-8111-111111111111';
  const entityId = '22222222-2222-4222-8222-222222222222';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects quote creation when discount exceeds subtotal', async () => {
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({ id: clientId });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      body: {
        clientId,
        discountAmount: 2000,
        lineItems: [{ description: 'Small task', quantity: 1, price: 1000 }],
      },
    };

    await expect(createQuote(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 400,
      code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
    });
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });

  it('rejects quote updates when discount exceeds the resulting subtotal', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: entityId,
      businessId: 'biz-1',
      subtotal: 1000,
      tax: 0,
      discount: 0,
      lineItems: [{ description: 'Small task', quantity: 1, price: 1000 }],
    });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: entityId },
      body: { discountAmount: 2000 },
    };

    await expect(updateQuote(req as never, { json: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 400,
      code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
    });
    expect(prisma.quote.update).not.toHaveBeenCalled();
  });

  it('rejects invoice creation when discount exceeds subtotal', async () => {
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({ id: clientId });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      body: {
        clientId,
        discountAmount: 2000,
        lineItems: [{ description: 'Small task', quantity: 1, price: 1000 }],
      },
    };

    await expect(createInvoice(req as never, { status: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 400,
      code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
    });
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects invoice updates when discount exceeds the resulting subtotal', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: entityId,
      businessId: 'biz-1',
      subtotal: 1000,
      tax: 0,
      discount: 0,
      lineItems: [{ description: 'Small task', quantity: 1, price: 1000 }],
      payments: [],
    });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: entityId },
      body: { discountAmount: 2000 },
    };

    await expect(updateInvoice(req as never, { json: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 400,
      code: 'DISCOUNT_EXCEEDS_SUBTOTAL',
    });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});
