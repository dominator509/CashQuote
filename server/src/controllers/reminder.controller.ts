import { Request, Response } from 'express';
import { createReminderSchema } from 'shared';
import {
  createReminder,
  listReminders,
  resolveReminder,
  sendReminder,
} from '../services/reminders/reminder.service';

export const getReminders = async (req: Request, res: Response) => {
  const reminders = await listReminders(req.business!.id);
  res.json(reminders);
};

export const postReminder = async (req: Request, res: Response) => {
  const data = createReminderSchema.parse(req.body);
  const reminder = await createReminder(req.business!.id, req.user?.id, data);
  res.status(201).json(reminder);
};

export const postSendReminder = async (req: Request, res: Response) => {
  const reminder = await sendReminder(req.business!.id, req.user?.id, req.params.id);
  res.json(reminder);
};

export const postResolveReminder = async (req: Request, res: Response) => {
  const reminder = await resolveReminder(req.business!.id, req.user?.id, req.params.id);
  res.json(reminder);
};
