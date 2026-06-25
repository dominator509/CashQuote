import { Request, Response } from 'express';
import { prisma } from 'db';
import { assertProductionReady } from '../config/env';

export const healthz = (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
};

export const readyz = async (_req: Request, res: Response) => {
  assertProductionReady();
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ready' });
};
