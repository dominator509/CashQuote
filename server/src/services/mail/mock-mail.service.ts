import { IMailService, ReminderMailInput } from './mail.service';

export class MockMailService implements IMailService {
  async sendReminder(input: ReminderMailInput): Promise<void> {
    console.log(
      `Mock reminder sent for ${input.entityType} ${input.entityId} in business ${input.businessId}`
    );
  }
}
