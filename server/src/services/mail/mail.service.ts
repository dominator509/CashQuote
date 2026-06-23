export interface ReminderMailInput {
  businessId: string;
  entityId: string;
  entityType: 'quote' | 'invoice';
}

export interface IMailService {
  sendReminder(input: ReminderMailInput): Promise<void>;
}
