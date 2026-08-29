import { AppError } from '../../middlewares/error';
import { IMailService } from './mail.service';
import { MockMailService } from './mock-mail.service';
import { SmtpMailService } from './smtp-mail.service';
import { getSmtpConfig, isMockEmailAllowed } from '../../config/env';

export const getReminderMailService = (): IMailService => {
  if (process.env.SMTP_URL || process.env.SMTP_FROM) {
    try {
      getSmtpConfig();
    } catch {
      throw new AppError('Email provider is not configured', 503, 'EMAIL_NOT_CONFIGURED');
    }
    return new SmtpMailService();
  }

  if (isMockEmailAllowed()) {
    return new MockMailService();
  }

  throw new AppError('Email provider is not configured', 503, 'EMAIL_NOT_CONFIGURED');
};
