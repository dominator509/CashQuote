import { prisma } from 'db';
import { createInvoice, updateInvoice } from '../../server/src/controllers/invoice.controller';

jest.mock('db', () => ({
  prisma: {
    client: {
      findFirst: jest.fn(),
    },
    invoice: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    invoiceLineItem: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}));

describe('invoice financial state hardening', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('rejects invoice updates that would make recorded payments exceed the invoice total', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      businessId: 'biz-1',
      subtotal: 1000,
      tax: 0,
      discount: 0,
      lineItems: [
        {
          id: 'line-1',
          invoiceId: '11111111-1111-4111-8111-111111111111',
          businessId: 'biz-1',
          description: 'Original work',
          quantity: 1,
          price: 1000,
        },
      ],
      payments: [{ id: 'pay-1', amount: 900 }],
    });
    (prisma.invoiceLineItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'line-2',
        invoiceId: '11111111-1111-4111-8111-111111111111',
        businessId: 'biz-1',
        description: 'Reduced work',
        quantity: 1,
        price: 500,
      },
    ]);
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: '11111111-1111-4111-8111-111111111111' },
      body: {
        lineItems: [
          {
            description: 'Reduced work',
            quantity: 1,
            price: 500,
          },
        ],
      },
    };
    const res = { json: jest.fn() };

    await expect(updateInvoice(req as never, res as never)).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invoice total cannot be less than recorded payments',
    });
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('derives created invoice status from payments instead of trusting a paid request status', async () => {
    (prisma.client.findFirst as jest.Mock).mockResolvedValue({ id: 'client-1' });
    (prisma.invoice.create as jest.Mock).mockResolvedValue({ id: 'inv-1' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      body: {
        clientId: '11111111-1111-4111-8111-111111111111',
        status: 'paid',
        lineItems: [
          {
            description: 'Original work',
            quantity: 1,
            price: 1000,
          },
        ],
      },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createInvoice(req as never, res as never);

    expect(prisma.invoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'unpaid' }),
      })
    );
  });

  it('recomputes paid invoice status to unpaid when an update raises total above recorded payments', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      businessId: 'biz-1',
      subtotal: 1000,
      tax: 0,
      discount: 0,
      lineItems: [
        {
          id: 'line-1',
          invoiceId: '11111111-1111-4111-8111-111111111111',
          businessId: 'biz-1',
          description: 'Original work',
          quantity: 1,
          price: 1000,
        },
      ],
      payments: [{ id: 'pay-1', amount: 1000 }],
    });
    (prisma.invoiceLineItem.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'line-2',
        invoiceId: '11111111-1111-4111-8111-111111111111',
        businessId: 'biz-1',
        description: 'Expanded work',
        quantity: 1,
        price: 1500,
      },
    ]);
    (prisma.invoice.update as jest.Mock).mockResolvedValue({ id: 'inv-1' });
    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: '11111111-1111-4111-8111-111111111111' },
      body: {
        status: 'paid',
        lineItems: [
          {
            description: 'Expanded work',
            quantity: 1,
            price: 1500,
          },
        ],
      },
    };
    const res = { json: jest.fn() };

    await updateInvoice(req as never, res as never);

    expect(prisma.invoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'unpaid', total: 1500 }),
      })
    );
  });

  it('rejects updates to void invoices before rewriting financial state', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: '11111111-1111-4111-8111-111111111111',
      businessId: 'biz-1',
      status: 'void',
      subtotal: 1000,
      tax: 0,
      discount: 0,
      lineItems: [
        {
          id: 'line-1',
          invoiceId: '11111111-1111-4111-8111-111111111111',
          businessId: 'biz-1',
          description: 'Original work',
          quantity: 1,
          price: 1000,
        },
      ],
      payments: [],
    });

    const req = {
      business: { id: 'biz-1' },
      user: { id: 'user-1' },
      params: { id: '11111111-1111-4111-8111-111111111111' },
      body: { status: 'unpaid' },
    };

    await expect(updateInvoice(req as never, { json: jest.fn() } as never)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVOICE_IS_VOID',
      message: 'Void invoices cannot be updated',
    });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.invoiceLineItem.deleteMany).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
    expect(prisma.activityLog.create).not.toHaveBeenCalled();
  });
});
