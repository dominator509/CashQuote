import nodemailer from 'nodemailer';
import { buildReminderSubject, IMailService, ReminderMailInput } from './mail.service';
import { getSmtpConfig } from '../../config/env';

export class SmtpMailService implements IMailService {
  async sendReminder(input: ReminderMailInput): Promise<void> {
    const { smtpUrl, smtpFrom: from } = getSmtpConfig();

    const transporter = nodemailer.createTransport(smtpUrl);
    await transporter.sendMail({
      from,
      to: input.to,
      subject: buildReminderSubject(input),
      text: `Reminder for ${input.entityType} ${input.entityId} in business ${input.businessId}.`,
    });
  }
}
