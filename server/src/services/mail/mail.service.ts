export interface ReminderMailInput {
  businessId: string;
  entityId: string;
  entityType: 'quote' | 'invoice';
}

export interface IMailService {
  sendReminder(input: ReminderMailInput): Promise<void>;
}

export const buildReminderSubject = (input: ReminderMailInput): string =>
  `CashQuote reminder for ${input.entityType} ${input.entityId}`;
