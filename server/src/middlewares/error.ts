import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env';
import { logger } from '../services/logger/logger.service';

type BodyParserError = Error & {
  status?: number;
  type?: string;
};

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const bodyParserError = err as BodyParserError;
  if (bodyParserError.type === 'entity.too.large' || bodyParserError.status === 413) {
    res.status(413).json({ error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }

  if (bodyParserError.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON request body', code: 'MALFORMED_JSON' });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      ...(isProduction() ? {} : { details: err.issues }),
    });
    return;
  }

  const requestLog = (req as Request & { log?: typeof logger }).log || logger;
  requestLog.error({ err, requestId: req.requestId }, 'Unhandled request error');
  res.status(500).json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR' });
};
