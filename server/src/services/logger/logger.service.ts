import pino from 'pino';

export const logger = pino({
  level:
    process.env.LOG_LEVEL ||
    (process.env.NODE_ENV === 'test'
      ? 'silent'
      : process.env.NODE_ENV === 'production'
        ? 'info'
        : 'debug'),
});
