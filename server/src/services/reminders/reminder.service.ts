import { prisma } from 'db';
import { AppError } from '../../middlewares/error';
import { getReminderMailService } from '../mail/mail-provider.service';

type EntityType = 'quote' | 'invoice';

const ensureEntityExists = async (entityType: EntityType, entityId: string, businessId: string) => {
  if (entityType === 'quote') {
    const quote = await prisma.quote.findFirst({ where: { id: entityId, businessId } });
    if (!quote) throw new AppError('Quote not found', 404);
    return;
  }

  const invoice = await prisma.invoice.findFirst({ where: { id: entityId, businessId } });
  if (!invoice) throw new AppError('Invoice not found', 404);
};

export const listReminders = async (businessId: string) => {
  return prisma.reminder.findMany({
    where: { businessId },
    orderBy: { scheduledAt: 'asc' },
  });
};

export const createReminder = async (
  businessId: string,
  userId: string | undefined,
  input: { entityType: EntityType; entityId: string; scheduledAt: string }
) => {
  await ensureEntityExists(input.entityType, input.entityId, businessId);

  const reminder = await prisma.reminder.create({
    data: {
      businessId,
      entityType: input.entityType,
      entityId: input.entityId,
      scheduledAt: new Date(input.scheduledAt),
    },
  });

  await prisma.activityLog.create({
    data: {
      businessId,
      userId,
      action: 'reminder_create',
      entityId: reminder.id,
      entityType: 'reminder',
      details: `Created reminder for ${input.entityType} ${input.entityId}`,
    },
  });

  return reminder;
};

export const sendReminder = async (businessId: string, userId: string | undefined, id: string) => {
  const reminder = await prisma.reminder.findFirst({
    where: { id, businessId },
  });

  if (!reminder) {
    throw new AppError('Reminder not found', 404);
  }

  if (reminder.status === 'sent') {
    throw new AppError('Reminder has already been sent', 409);
  }

  if (reminder.status === 'resolved') {
    throw new AppError('Reminder has already been resolved', 409);
  }

  const entityType = reminder.entityType === 'quote' ? 'quote' : 'invoice';
  const mailService = getReminderMailService();
  await mailService.sendReminder({
    businessId,
    entityId: reminder.entityId,
    entityType,
  });

  const updated = await prisma.reminder.update({
    where: { id },
    data: { status: 'sent' },
  });

  await prisma.activityLog.create({
    data: {
      businessId,
      userId,
      action: 'reminder_send',
      entityId: id,
      entityType: 'reminder',
    },
  });

  return updated;
};

export const resolveReminder = async (
  businessId: string,
  userId: string | undefined,
  id: string
) => {
  const reminder = await prisma.reminder.findFirst({
    where: { id, businessId },
  });

  if (!reminder) {
    throw new AppError('Reminder not found', 404);
  }

  if (reminder.status === 'resolved') {
    throw new AppError('Reminder is already resolved', 409);
  }

  const updated = await prisma.reminder.update({
    where: { id },
    data: { status: 'resolved' },
  });

  await prisma.activityLog.create({
    data: {
      businessId,
      userId,
      action: 'reminder_resolve',
      entityId: id,
      entityType: 'reminder',
    },
  });

  return updated;
};
