import nodemailer from 'nodemailer';
import { prisma } from 'db';
import { sendReminder } from '../../server/src/services/reminders/reminder.service';

jest.mock('db', () => ({
  prisma: {
    reminder: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    quote: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  },
}));

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('reminder delivery idempotency', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      SMTP_URL: 'smtps://localhost:1025',
      SMTP_FROM: 'billing@example.com',
    };

    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-1',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'client@example.com' },
    });
    (prisma.reminder.update as jest.Mock).mockResolvedValue({
      id: 'rem-1',
      status: 'sending',
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('keeps the sending claim when SMTP fails ambiguously', async () => {
    const smtpError = Object.assign(new Error('SMTP connection timed out'), {
      code: 'ETIMEDOUT',
    });
    const sendMail = jest.fn().mockRejectedValue(smtpError);
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    await expect(sendReminder('biz-1', 'user-1', 'rem-1')).rejects.toBe(smtpError);

    expect(prisma.reminder.update).toHaveBeenCalledWith({
      where: { id: 'rem-1', businessId: 'biz-1', status: 'pending' },
      data: { status: 'sending' },
    });
    expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'client@example.com' })
    );
  });
});
