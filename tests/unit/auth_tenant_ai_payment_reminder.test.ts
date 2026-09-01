import {
  getCorsOrigins,
  getJwtSecret,
  getPilotAccessCode,
  getProductionReadinessConfig,
  getSmtpConfig,
  getTrustProxy,
  isMockEmailAllowed,
} from '../../server/src/config/env';
import { requireBusinessId, requireBusinessOwner } from '../../server/src/middlewares/tenant';
import { generateLineItemsWithFallback } from '../../server/src/services/ai/generation.service';
import {
  aiGeneratedLineItemSchema,
  aiGeneratedLineItemsSchema,
} from '../../server/src/services/ai/ai.service';
import { OpenAiAdapter } from '../../server/src/services/ai/openai.adapter';
import {
  createInvoicePayment,
  deleteInvoicePayment,
} from '../../server/src/services/billing/payment.service';
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
    reminder: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
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

  it('rejects whitespace-only required production configuration', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_EMAIL;
    process.env.DATABASE_URL = '   ';

    expect(() => getProductionReadinessConfig()).toThrow(
      expect.objectContaining({ code: 'CONFIG_MISSING' })
    );
  });

  it('rejects a whitespace-only pilot access code in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCK_EMAIL;
    process.env.PILOT_ACCESS_CODE = '                ';

    expect(() => getProductionReadinessConfig()).toThrow(
      expect.objectContaining({ code: 'CONFIG_MISSING' })
    );
  });

  it('rejects the development JWT secret in production', () => {
    process.env.JWT_SECRET = 'development-only-jwt-secret';
    process.env.NODE_ENV = 'production';

    try {
      getJwtSecret();
      throw new Error('Expected getJwtSecret to throw');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 500,
        code: 'CONFIG_WEAK_SECRET',
        message: 'JWT_SECRET must not use the development default in production',
      });
    }
  });

  it('rejects the documented JWT placeholder in production', () => {
    process.env.JWT_SECRET = 'replace-with-a-long-random-secret';
    process.env.NODE_ENV = 'production';

    expect(() => getJwtSecret()).toThrow(
      expect.objectContaining({
        statusCode: 500,
        code: 'CONFIG_WEAK_SECRET',
        message: 'JWT_SECRET must be a private, non-default value in production',
      })
    );
  });

  it('rejects short JWT secrets in production', () => {
    process.env.JWT_SECRET = 'short-production-secret';
    process.env.NODE_ENV = 'production';

    expect(() => getJwtSecret()).toThrow(
      expect.objectContaining({
        statusCode: 500,
        code: 'CONFIG_WEAK_SECRET',
        message: 'JWT_SECRET must be a private, non-default value in production',
      })
    );
  });

  it('rejects weak pilot access codes in production', () => {
    process.env.PILOT_ACCESS_CODE = 'pilot-code';
    process.env.NODE_ENV = 'production';

    try {
      getPilotAccessCode();
      throw new Error('Expected getPilotAccessCode to throw');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 500,
        code: 'CONFIG_WEAK_ACCESS_CODE',
        message: 'PILOT_ACCESS_CODE must be a private, non-default value in production',
      });
    }
  });

  it('rejects wildcard CORS origins in production', () => {
    process.env.CORS_ORIGIN = '*';
    process.env.NODE_ENV = 'production';

    try {
      getCorsOrigins();
      throw new Error('Expected getCorsOrigins to throw');
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 500,
        code: 'CONFIG_INVALID_ORIGIN',
        message: 'CORS_ORIGIN must not use a wildcard in production',
      });
    }
  });

  it('rejects an empty configured CORS origin list', () => {
    process.env.CORS_ORIGIN = ',  ';

    expect(() => getCorsOrigins()).toThrow(
      expect.objectContaining({ code: 'CONFIG_INVALID_ORIGIN' })
    );
  });

  it('does not trust forwarded client addresses by default in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TRUST_PROXY;

    expect(getTrustProxy()).toBe(false);
  });

  it('accepts one trusted proxy hop only when explicitly configured', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = 'true';

    expect(getTrustProxy()).toBe(1);
  });

  it('rejects invalid proxy configuration', () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = 'all';

    expect(() => getTrustProxy()).toThrow(
      expect.objectContaining({ code: 'CONFIG_INVALID_TRUST_PROXY' })
    );
  });

  it('never allows mock email in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_EMAIL = 'true';

    expect(isMockEmailAllowed()).toBe(false);
  });

  it('rejects non-SMTP transport URLs', () => {
    process.env.SMTP_URL = 'https://mail.example.com';
    process.env.SMTP_FROM = 'billing@example.com';

    expect(() => getSmtpConfig()).toThrow(
      expect.objectContaining({ code: 'CONFIG_INVALID_SMTP' })
    );
  });

  it('rejects an invalid SMTP sender address', () => {
    process.env.SMTP_URL = 'smtp://mail.example.com';
    process.env.SMTP_FROM = 'not-an-email';

    expect(() => getSmtpConfig()).toThrow(
      expect.objectContaining({
        code: 'CONFIG_INVALID_SMTP',
        message: 'SMTP_FROM must be a valid email address',
      })
    );
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

  it('rejects blank tenant headers before querying membership', async () => {
    const req = {
      headers: { 'x-business-id': '   ' },
      user: { id: 'user-1' },
    };

    await expect(requireBusinessId(req as never, {} as never, jest.fn())).rejects.toMatchObject({
      statusCode: 400,
      code: 'TENANT_REQUIRED',
    });
    expect(prisma.businessMember.findUnique).not.toHaveBeenCalled();
  });

  it('rejects duplicated tenant headers before querying membership', async () => {
    const req = {
      headers: { 'x-business-id': ['biz-1', 'biz-2'] },
      user: { id: 'user-1' },
    };

    await expect(requireBusinessId(req as never, {} as never, jest.fn())).rejects.toMatchObject({
      statusCode: 400,
      code: 'TENANT_REQUIRED',
    });
    expect(prisma.businessMember.findUnique).not.toHaveBeenCalled();
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

  it('uses the canonical persisted line-item bounds for AI output', () => {
    expect(
      aiGeneratedLineItemSchema.safeParse({
        description: 'x'.repeat(501),
        quantity: 10_001,
        price: 100_000_001,
        category: 'x'.repeat(51),
      }).success
    ).toBe(false);
  });

  it('requires at least one AI-generated line item', () => {
    expect(aiGeneratedLineItemsSchema.safeParse([]).success).toBe(false);
  });

  it('applies persistence collection limits to AI-generated line items', () => {
    const overLimitItems = Array.from({ length: 101 }, (_, index) => ({
      description: `Item ${index}`,
      quantity: 1,
      price: 1,
    }));

    expect(aiGeneratedLineItemsSchema.safeParse(overLimitItems).success).toBe(false);
    expect(
      aiGeneratedLineItemsSchema.safeParse([
        { description: 'A', quantity: 10_000, price: 107_374_182 },
        { description: 'B', quantity: 10_000, price: 107_374_182 },
      ]).success
    ).toBe(false);
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

  it('rejects future-dated payments before writing invoice state', async () => {
    await expect(
      createInvoicePayment('inv-1', 'biz-1', 'user-1', {
        amount: 100,
        method: 'manual',
        paidAt: '2099-01-01T00:00:00.000Z',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'PAYMENT_DATE_IN_FUTURE',
      message: 'Payment date cannot be in the future',
    });

    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    expect(prisma.payment.create).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('rejects deleting payments from a void invoice', async () => {
    (prisma.invoice.findFirst as jest.Mock).mockResolvedValue({
      id: 'inv-1',
      status: 'void',
      total: 1000,
      payments: [{ id: 'pay-1', amount: 1000 }],
    });

    await expect(deleteInvoicePayment('inv-1', 'pay-1', 'biz-1', 'user-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot delete payments for a void invoice',
    });
    expect(prisma.payment.delete).not.toHaveBeenCalled();
    expect(prisma.invoice.update).not.toHaveBeenCalled();
  });

  it('creates and sends reminders through the mock mail path', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.SMTP_URL;
    delete process.env.SMTP_FROM;
    process.env.ALLOW_MOCK_EMAIL = 'true';
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'client@example.com' },
    });
    (prisma.reminder.create as jest.Mock).mockResolvedValue({ id: 'rem-1', status: 'pending' });
    (prisma.reminder.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'rem-1',
        entityId: 'quote-1',
        entityType: 'quote',
        scheduledAt: new Date().toISOString(),
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
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('client@example.com'));
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate active reminders for the same entity', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'client@example.com' },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-existing',
      status: 'pending',
    });

    await expect(
      createReminder('biz-1', 'user-1', {
        entityType: 'quote',
        entityId: 'quote-1',
        scheduledAt: new Date().toISOString(),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'ACTIVE_REMINDER_EXISTS',
    });
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it('rejects backdated reminders before reading or writing reminder state', async () => {
    await expect(
      createReminder('biz-1', 'user-1', {
        entityType: 'quote',
        entityId: 'quote-1',
        scheduledAt: '2000-01-01T00:00:00.000Z',
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'REMINDER_DATE_IN_PAST',
      message: 'Reminder date cannot be in the past',
    });

    expect(prisma.quote.findFirst).not.toHaveBeenCalled();
    expect(prisma.reminder.findFirst).not.toHaveBeenCalled();
    expect(prisma.reminder.create).not.toHaveBeenCalled();
  });

  it('fails reminder send in production when email is not configured, even if mock email is enabled', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_URL;
    delete process.env.SMTP_FROM;
    process.env.ALLOW_MOCK_EMAIL = 'true';
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'client@example.com' },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-prod',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-prod')).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
  });

  it('fails reminder send when SMTP config is partial even if mock email is allowed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_URL = 'smtp://localhost:1025';
    delete process.env.SMTP_FROM;
    process.env.ALLOW_MOCK_EMAIL = 'true';
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'client@example.com' },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-partial',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-partial')).rejects.toMatchObject({
      statusCode: 503,
      code: 'EMAIL_NOT_CONFIGURED',
    });
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('prevents sending a reminder when its target entity no longer exists', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-orphan',
      status: 'pending',
      entityId: 'quote-missing',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-orphan')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Quote not found',
    });
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('rejects sending a reminder when the client has no email address', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: null },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-no-email',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-no-email')).rejects.toMatchObject({
      statusCode: 400,
      code: 'REMINDER_CLIENT_EMAIL_MISSING',
    });
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('rejects sending a reminder when the client email is invalid', async () => {
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'not-an-email' },
    });
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-invalid-email',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-invalid-email')).rejects.toMatchObject({
      statusCode: 400,
      code: 'REMINDER_CLIENT_EMAIL_INVALID',
    });
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('prevents sending a reminder before its scheduled time', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-future',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-future')).rejects.toMatchObject({
      statusCode: 409,
      code: 'REMINDER_NOT_DUE',
      message: 'Reminder is not scheduled to send yet',
    });

    expect(prisma.quote.findFirst).not.toHaveBeenCalled();
    expect(prisma.reminder.update).not.toHaveBeenCalled();
  });

  it('fails closed for an invalid persisted reminder entity type', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-invalid-type',
      status: 'pending',
      entityId: 'unknown-entity',
      entityType: 'client',
      scheduledAt: new Date().toISOString(),
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-invalid-type')).rejects.toMatchObject({
      statusCode: 500,
      code: 'REMINDER_ENTITY_TYPE_INVALID',
    });

    expect(prisma.quote.findFirst).not.toHaveBeenCalled();
    expect(prisma.invoice.findFirst).not.toHaveBeenCalled();
    expect(prisma.reminder.update).not.toHaveBeenCalled();
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

  it('does not send a reminder that is already claimed by another request', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-sending',
      status: 'sending',
      entityId: 'quote-1',
      entityType: 'quote',
    });

    await expect(sendReminder('biz-1', 'user-1', 'rem-sending')).rejects.toMatchObject({
      statusCode: 409,
      code: 'REMINDER_SEND_IN_PROGRESS',
    });
    expect(prisma.reminder.update).not.toHaveBeenCalled();
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

  it('updates reminder resolution and activity log atomically', async () => {
    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-5',
      status: 'sent',
    });
    (prisma.reminder.update as jest.Mock).mockResolvedValue({ id: 'rem-5', status: 'resolved' });

    const resolved = await resolveReminder('biz-1', 'user-1', 'rem-5');

    expect(resolved.status).toBe('resolved');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'reminder_resolve',
        entityId: 'rem-5',
      }),
    });
  });
}); 
