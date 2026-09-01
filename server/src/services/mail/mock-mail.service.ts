import { IMailService, ReminderMailInput } from './mail.service';
import { logger } from '../logger/logger.service';

export class MockMailService implements IMailService {
  async sendReminder(input: ReminderMailInput): Promise<void> {
    logger.info(
      {
        businessId: input.businessId,
        entityId: input.entityId,
        entityType: input.entityType,
      },
      'Mock reminder sent'
    );
  }
}
