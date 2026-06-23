import { getJwtSecret } from '../../server/src/config/env';
import { requireBusinessId } from '../../server/src/middlewares/tenant';
import { generateLineItemsWithFallback } from '../../server/src/services/ai/generation.service';
import { OpenAiAdapter } from '../../server/src/services/ai/openai.adapter';
import { createInvoicePayment } from '../../server/src/services/billing/payment.service';
import { createReminder, sendReminder } from '../../server/src/services/reminders/reminder.service';
import { prisma } from 'db';

jest.mock('db', () => ({
  prisma: {
    businessMember: { findUnique: jest.fn() },
    invoice: { findFirst: jest.fn(), update: jest.fn() },
    payment: { create: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
    activityLog: { create: jest.fn() },
    quote: { findFirst: jest.fn() },
    reminder: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(async (cb) => cb(prisma)),
  },
}));

describe('Production MVP security and workflow seams', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects missing JWT_SECRET in production', () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';

    try {
      getJwtSecret();
      throw new Error('Expected getJwtSecret to throw');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 500,
        message: 'JWT_SECRET must be configured in production',
      });
    }
  });

  it('accepts tenant context only when user is a business member', async () => {
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue({
      business: { id: 'biz-1' },
    });
    const req = {
      headers: { 'x-business-id': 'biz-1' },
      user: { id: 'user-1' },
    };
    const next = jest.fn();

    await requireBusinessId(req as never, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect((req as { business?: { id: string } }).business?.id).toBe('biz-1');
  });

  it('rejects tenant context when membership is missing', async () => {
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue(null);
    const req = {
      headers: { 'x-business-id': 'biz-2' },
      user: { id: 'user-1' },
    };

    await expect(requireBusinessId(req as never, {} as never, jest.fn())).rejects.toMatchObject({
      statusCode: 403,
    });
  });

  it('falls back to mock AI output when OpenAI fails', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest.spyOn(OpenAiAdapter.prototype, 'generateLineItems').mockRejectedValueOnce(new Error('boom'));

    const result = await generateLineItemsWithFallback('5 hours of dev work');

    expect(result.provider).toBe('mock');
    expect(result.degraded).toBe(true);
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('records payment and marks invoice paid when total is covered', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      status: 'unpaid',
      total: 1000,
      payments: [],
    });
    (prisma.payment.create as jest.Mock).mockResolvedValue({ id: 'pay-1', amount: 1000 });

    await createInvoicePayment('inv-1', 'biz-1', 'user-1', {
      amount: 1000,
      method: 'manual',
    });

    expect(prisma.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-1' },
      data: { status: 'paid' },
    });
  });

  it('rejects overpayments', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      status: 'unpaid',
      total: 1000,
      payments: [{ amount: 900 }],
    });

    await expect(
      createInvoicePayment('inv-1', 'biz-1', 'user-1', {
        amount: 200,
        method: 'manual',
      })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('creates and sends reminders through the mock mail path', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({ id: 'quote-1' });
    (prisma.reminder.create as jest.Mock).mockResolvedValue({ id: 'rem-1', status: 'pending' });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-1',
      entityId: 'quote-1',
      entityType: 'quote',
    });
    (prisma.reminder.update as jest.Mock).mockResolvedValue({ id: 'rem-1', status: 'sent' });
    jest.spyOn(console, 'log').mockImplementation(() => undefined);

    const reminder = await createReminder('biz-1', 'user-1', {
      entityType: 'quote',
      entityId: 'quote-1',
      scheduledAt: new Date().toISOString(),
    });
    const sent = await sendReminder('biz-1', 'user-1', reminder.id);

    expect(sent.status).toBe('sent');
  });
});
