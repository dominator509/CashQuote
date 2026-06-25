import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import pinoHttp from 'pino-http';
import { logger } from '../services/logger/logger.service';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req: Request) => {
    const existing = req.headers['x-request-id'];
    const requestId = Array.isArray(existing) ? existing[0] : existing || randomUUID();
    req.requestId = requestId;
    return requestId;
  },
  customProps: (req: Request) => ({
    userId: req.user?.id,
    businessId: req.business?.id,
  }),
  customSuccessMessage: (req: Request, res: Response) =>
    `${req.method} ${req.path} completed with ${res.statusCode}`,
  customErrorMessage: (req: Request, res: Response) =>
    `${req.method} ${req.path} failed with ${res.statusCode}`,
});
