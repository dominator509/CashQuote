import { prisma } from 'db';
import { AppError } from '../../middlewares/error';
import { getReminderMailService } from '../mail/mail-provider.service';
import { runSerializableTransaction, isPrismaErrorCode } from '../billing/transaction.service';
import { ACTIVE_REMINDER_STATUSES } from './reminder-status';

type EntityType = 'quote' | 'invoice';
const REMINDER_CLOCK_SKEW_MS = 60_000;

type ReminderTarget = {
  clientEmail: string | null;
};

const ensureEntityExists = async (
  entityType: EntityType,
  entityId: string,
  businessId: string
): Promise<ReminderTarget> => {
  if (entityType === 'quote') {
    const quote = await prisma.quote.findFirst({
      where: { id: entityId, businessId },
      include: { client: { select: { email: true } } },
    });
    if (!quote) throw new AppError('Quote not found', 404);
    return { clientEmail: quote.client?.email ?? null };
  }

  const invoice = await prisma.invoice.findFirst({
    where: { id: entityId, businessId },
    include: { client: { select: { email: true } } },
  });
  if (!invoice) throw new AppError('Invoice not found', 404);
  return { clientEmail: invoice.client?.email ?? null };
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

  try {
    return await runSerializableTransaction(async (tx) => {
      const activeReminder = await tx.reminder.findFirst({
        where: {
          businessId,
          entityType: input.entityType,
          entityId: input.entityId,
          status: { in: [...ACTIVE_REMINDER_STATUSES] },
        },
      });

      if (activeReminder) {
        throw new AppError(
          'Active reminder already exists for this entity',
          409,
          'ACTIVE_REMINDER_EXISTS'
        );
      }

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
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2002')) {
      throw new AppError(
        'Active reminder already exists for this entity',
        409,
        'ACTIVE_REMINDER_EXISTS'
      );
    }
    throw error;
  }
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

  if (reminder.status === 'sending') {
    throw new AppError('Reminder is already being sent', 409, 'REMINDER_SEND_IN_PROGRESS');
  }

  if (new Date(reminder.scheduledAt).getTime() > Date.now() + REMINDER_CLOCK_SKEW_MS) {
    throw new AppError('Reminder is not scheduled to send yet', 409, 'REMINDER_NOT_DUE');
  }

  const entityType = reminder.entityType === 'quote' ? 'quote' : 'invoice';
  const target = await ensureEntityExists(entityType, reminder.entityId, businessId);
  if (!target.clientEmail) {
    throw new AppError(
      'Client email is required to send a reminder',
      400,
      'REMINDER_CLIENT_EMAIL_MISSING'
    );
  }

  const mailService = getReminderMailService();
  try {
    await prisma.reminder.update({
      where: { id, businessId, status: 'pending' },
      data: { status: 'sending' },
    });
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new AppError('Reminder is already being sent', 409, 'REMINDER_SEND_IN_PROGRESS');
    }
    throw error;
  }

  try {
    await mailService.sendReminder({
      to: target.clientEmail,
      businessId,
      entityId: reminder.entityId,
      entityType,
    });
  } catch (error) {
    // A definite provider failure can safely return the reminder to pending.
    // An abrupt process exit leaves it in sending, preventing an unsafe retry
    // after SMTP may already have accepted the message.
    try {
      await prisma.reminder.updateMany({
        where: { id, businessId, status: 'sending' },
        data: { status: 'pending' },
      });
    } catch {
      // Preserve the original provider error; the sending state is durable for
      // an operator to inspect and recover explicitly.
    }
    throw error;
  }

  try {
    return await runSerializableTransaction(async (tx) => {
      const updated = await tx.reminder.update({
        where: { id, businessId, status: 'sending' },
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
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new AppError('Reminder state changed while sending', 409, 'REMINDER_STATE_CHANGED');
    }
    throw error;
  }
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

  if (reminder.status === 'sending') {
    throw new AppError('Reminder is already being sent', 409, 'REMINDER_SEND_IN_PROGRESS');
  }

  try {
    return await runSerializableTransaction(async (tx) => {
      const updated = await tx.reminder.update({
        where: { id, businessId, status: { in: ['pending', 'sent'] } },
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
  } catch (error) {
    if (isPrismaErrorCode(error, 'P2025')) {
      throw new AppError('Reminder state changed while resolving', 409, 'REMINDER_STATE_CHANGED');
    }
    throw error;
  }
};
