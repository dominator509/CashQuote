import { Writable } from 'node:stream';
import { createLogger } from '../../server/src/services/logger/logger.service';

describe('request log redaction', () => {
  it('does not persist session or authorization headers', () => {
    const chunks: string[] = [];
    const destination = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(chunk.toString());
        callback();
      },
    });
    const previousNodeEnv = process.env.NODE_ENV;
    const previousLogLevel = process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'development';
    delete process.env.LOG_LEVEL;

    try {
      const logger = createLogger(destination);
      logger.info(
        {
          req: {
            headers: {
              cookie: 'session-token-test',
              authorization: 'Bearer authorization-token-test',
            },
          },
          res: {
            headers: {
              'set-cookie': ['token=response-session-token-test'],
            },
          },
        },
        'request'
      );
      logger.flush();
    } finally {
      process.env.NODE_ENV = previousNodeEnv;
      if (previousLogLevel === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = previousLogLevel;
      }
    }

    const output = chunks.join('');
    expect(output).toContain('[Redacted]');
    expect(output).not.toContain('session-token-test');
    expect(output).not.toContain('authorization-token-test');
    expect(output).not.toContain('response-session-token-test');
  });
});
