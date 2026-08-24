import { AppError } from '../../middlewares/error';
import { logger } from '../logger/logger.service';
import { IMailService } from './mail.service';
import { MockMailService } from './mock-mail.service';
import { SmtpMailService } from './smtp-mail.service';
import { isMockEmailAllowed, isProduction } from '../../config/env';

export const getReminderMailService = (): IMailService => {
  if (process.env.SMTP_URL && process.env.SMTP_FROM) {
    return new SmtpMailService();
  }

  if (process.env.SMTP_URL || process.env.SMTP_FROM) {
    throw new AppError('Email provider is not configured', 503, 'EMAIL_NOT_CONFIGURED');
  }

  if (isMockEmailAllowed()) {
    if (isProduction()) {
      logger.warn({ event: 'email_mock_allowed' }, 'Mock email enabled in production');
    }
    return new MockMailService();
  }

  throw new AppError('Email provider is not configured', 503, 'EMAIL_NOT_CONFIGURED');
};
