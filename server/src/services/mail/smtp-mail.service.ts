import nodemailer from 'nodemailer';
import { buildReminderSubject, IMailService, ReminderMailInput } from './mail.service';

export class SmtpMailService implements IMailService {
  async sendReminder(input: ReminderMailInput): Promise<void> {
    const smtpUrl = process.env.SMTP_URL;
    const from = process.env.SMTP_FROM;

    if (!smtpUrl || !from) {
      throw new Error('SMTP mail service is not configured');
    }

    const transporter = nodemailer.createTransport(smtpUrl);
    await transporter.sendMail({
      from,
      to: input.to,
      subject: buildReminderSubject(input),
      text: `Reminder for ${input.entityType} ${input.entityId} in business ${input.businessId}.`,
    });
  }
}
