import { getJwtSecret } from '../../server/src/config/env';
import { requireBusinessId, requireBusinessOwner } from '../../server/src/middlewares/tenant';
import { generateLineItemsWithFallback } from '../../server/src/services/ai/generation.service';
import { OpenAiAdapter } from '../../server/src/services/ai/openai.adapter';
import { createInvoicePayment } from '../../server/src/services/billing/payment.service';
import {
  createReminder,
  sendReminder,
  resolveReminder,
} from '../../server/src/services/reminders/reminder.service';
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
      role: 'owner',
      business: { id: 'biz-1' },
    });
    const req = {
      headers: { 'x-business-id': 'biz-1' },
      user: { id: 'user-1' },
    };
    const next = jest.fn();

    await requireBusinessId(req as never, {} as never, next);

    expect(next).toHaveBeenCalled();
    expect((req as { business?: { id: string }; user?: { role?: string } }).business?.id).toBe('biz-1');
    expect((req as { business?: { id: string }; user?: { role?: string } }).user?.role).toBe('owner');
  });

  it('assigns explicit member role from business membership', async () => {
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue({
      role: 'member',
      business: { id: 'biz-1' },
    });
    const req = {
      headers: { 'x-business-id': 'biz-1' },
      user: { id: 'user-1' },
    };
    const next = jest.fn();

    await requireBusinessId(req as never, {} as never, next);

    expect((req as { user?: { role?: string } }).user?.role).toBe('member');
    expect(next).toHaveBeenCalled();
  });

  it('forbids business-owner actions for non-owner members', () => {
    const req = {
      headers: { 'x-business-id': 'biz-1' },
      user: { id: 'user-1', role: 'member' },
    };
    const next = jest.fn();

    expect(() => requireBusinessOwner(req as never, {} as never, next)).toThrow('business ownership');
    expect(next).not.toHaveBeenCalled();
  });

  it('permits business-owner actions for owner role', () => {
    const req = {
      headers: { 'x-business-id': 'biz-1' },
      user: { id: 'user-1', role: 'owner' },
    };
    const next = jest.fn();

    requireBusinessOwner(req as never, {} as never, next);

    expect(next).toHaveBeenCalled();
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

  it('falls back to mock AI output when OpenAI returns malformed JSON', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest
      .spyOn(OpenAiAdapter.prototype, 'generateLineItems')
      .mockRejectedValueOnce(new SyntaxError('Malformed JSON in provider response'));

    const result = await generateLineItemsWithFallback('7-year inspection notes');

    expect(result.provider).toBe('mock');
    expect(result.degraded).toBe(true);
    expect(result.error).toBe('Malformed JSON in provider response');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('falls back to mock AI output on provider timeout', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    jest
      .spyOn(OpenAiAdapter.prototype, 'generateLineItems')
      .mockRejectedValueOnce(new Error('OpenAI request timed out'));

    const result = await generateLineItemsWithFallback('15 minutes of cleanup');

    expect(result.provider).toBe('mock');
    expect(result.degraded).toBe(true);
    expect(result.error).toBe('OpenAI request timed out');
    expect(result.items.length).toBeGreaterThan(0);
  });

  it('falls back to mock AI output when OPENAI_API_KEY is missing', async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await generateLineItemsWithFallback('3-hour maintenance windows');

    expect(result.provider).toBe('mock');
    expect(result.degraded).toBe(true);
    expect(result.error).toBe('OpenAI API key is missing');
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

  it('prevents sending a reminder that is already sent', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-2',
      status: 'sent',
      entityId: 'quote-1',
      entityType: 'quote',
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-2')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Reminder has already been sent',
    });
  });

  it('prevents sending a reminder that is already resolved', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-3',
      status: 'resolved',
      entityId: 'quote-1',
      entityType: 'quote',
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-3')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Reminder has already been resolved',
    });
  });

  it('prevents resolving a reminder that is already resolved', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-4',
      status: 'resolved',
    });

    await expect(resolveReminder('biz-1', 'user-1', 'rem-4')).rejects.toMatchObject({
      statusCode: 409,
      message: 'Reminder is already resolved',
    });
  });
}); 
