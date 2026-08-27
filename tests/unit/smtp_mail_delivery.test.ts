import nodemailer from 'nodemailer';
import { SmtpMailService } from '../../server/src/services/mail/smtp-mail.service';

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

describe('SMTP reminder delivery', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SMTP_URL: 'smtp://localhost:1025',
      SMTP_FROM: 'billing@example.com',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  it('sends to the client recipient while preserving the configured sender', async () => {
    const sendMail = jest.fn().mockResolvedValue({ messageId: 'message-1' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail });

    await new SmtpMailService().sendReminder({
      to: 'client@example.com',
      businessId: 'biz-1',
      entityId: 'invoice-1',
      entityType: 'invoice',
    });

    expect(nodemailer.createTransport).toHaveBeenCalledWith('smtp://localhost:1025');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'billing@example.com',
        to: 'client@example.com',
      })
    );
  });
});
