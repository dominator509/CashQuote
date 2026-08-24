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

describe('financial line item integrity', () => {
  const clientId = '11111111-1111-4111-8111-111111111111';
  const entityId = '22222222-2222-4222-8222-222222222222';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects quote creation without line items before client lookup', async () => {
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      body: { clientId, status: 'draft' },
    };

    await expect(createQuote(req as never, { status: jest.fn() } as never)).rejects.toHaveProperty(
      'issues'
    );
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.quote.create).not.toHaveBeenCalled();
  });

  it('rejects quote updates that would remove all line items before rewriting rows', async () => {
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: entityId },
      body: { lineItems: [] },
    };

    await expect(updateQuote(req as never, { json: jest.fn() } as never)).rejects.toHaveProperty(
      'issues'
    );
    expect(prisma.quote.findFirst).not.toHaveBeenCalled();
    expect(prisma.quoteLineItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.quote.update).not.toHaveBeenCalled();
  });

  it('rejects invoice creation without line items before client lookup', async () => {
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      body: { clientId, status: 'unpaid' },
    };

    await expect(createInvoice(req as never, { status: jest.fn() } as never)).rejects.toHaveProperty(
      'issues'
    );
    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
  });

  it('rejects invoice updates that would remove all line items before rewriting rows', async () => {
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: entityId },
      body: { lineItems: [] },
    };

    await expect(updateInvoice(req as never, { json: jest.fn() } as never)).rejects.toHaveProperty(
      'issues'
    );
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    expect(prisma.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });
});
