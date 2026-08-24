import { prisma } from 'db';
import { AppError } from '../../middlewares/error';
import { getReminderMailService } from '../mail/mail-provider.service';

type EntityType = 'quote' | 'invoice';
const REMINDER_CLOCK_SKEW_MS = 60_000;

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
  const scheduledAt = new Date(input.scheduledAt);
  if (scheduledAt.getTime() < Date.now() - REMINDER_CLOCK_SKEW_MS) {
    throw new AppError('Reminder date cannot be in the past', 400, 'REMINDER_DATE_IN_PAST');
  }

  await ensureEntityExists(input.entityType, input.entityId, businessId);
  const activeReminder = await prisma.reminder.findFirst({
    where: {
      businessId,
      entityType: input.entityType,
      entityId: input.entityId,
      status: { in: ['pending', 'sent'] },
    },
  });

  if (activeReminder) {
    throw new AppError('Active reminder already exists for this entity', 409, 'ACTIVE_REMINDER_EXISTS');
  }

  return prisma.$transaction(async (tx) => {
    const reminder = await tx.reminder.create({
      data: {
        businessId,
        entityType: input.entityType,
        entityId: input.entityId,
        scheduledAt,
      },
    });

    await tx.activityLog.create({
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
  });
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

  if (new Date(reminder.scheduledAt).getTime() > Date.now() + REMINDER_CLOCK_SKEW_MS) {
    throw new AppError('Reminder is not scheduled to send yet', 409, 'REMINDER_NOT_DUE');
  }

  const entityType = reminder.entityType === 'quote' ? 'quote' : 'invoice';
  await ensureEntityExists(entityType, reminder.entityId, businessId);
  const mailService = getReminderMailService();
  await mailService.sendReminder({
    businessId,
    entityId: reminder.entityId,
    entityType,
  });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reminder.update({
      where: { id },
      data: { status: 'sent' },
    });

    await tx.activityLog.create({
      data: {
        businessId,
        userId,
        action: 'reminder_send',
        entityId: id,
        entityType: 'reminder',
      },
    });

    return updated;
  });
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

  return prisma.$transaction(async (tx) => {
    const updated = await tx.reminder.update({
      where: { id },
      data: { status: 'resolved' },
    });

    await tx.activityLog.create({
      data: {
        businessId,
        userId,
        action: 'reminder_resolve',
        entityId: id,
        entityType: 'reminder',
      },
    });

    return updated;
  });
};
