import { Request, Response } from 'express';
import { z } from 'zod';
import { listActivityLogs } from '../services/activity/activity.service';

const listActivityLogsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().uuid().optional(),
});

export const getActivityLogs = async (req: Request, res: Response) => {
  const query = listActivityLogsSchema.parse(req.query);
  const logs = await listActivityLogs(req.business!.id, query);
  res.json(logs);
};
