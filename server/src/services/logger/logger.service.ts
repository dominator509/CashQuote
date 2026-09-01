import pino from 'pino';

export const createLogger = (destination?: pino.DestinationStream): pino.Logger =>
  pino(
    {
      level:
        process.env.LOG_LEVEL ||
        (process.env.NODE_ENV === 'test'
          ? 'silent'
          : process.env.NODE_ENV === 'production'
            ? 'info'
            : 'debug'),
      // pino-http's default request serializer includes incoming headers.
      // Never persist bearer session material or authorization credentials.
      redact: {
        paths: [
          'req.headers.cookie',
          'req.headers.authorization',
          'res.headers.set-cookie',
        ],
        censor: '[Redacted]',
      },
    },
    destination
  );

export const logger = createLogger();
