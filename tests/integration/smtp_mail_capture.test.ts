import net from 'node:net';
import { SmtpMailService } from '../../server/src/services/mail/smtp-mail.service';

type CapturedMail = {
  from?: string;
  to?: string;
};

type CaptureServer = {
  server: net.Server;
  port: number;
  mail: CapturedMail;
};

const startSmtpCapture = async (): Promise<CaptureServer> => {
  const mail: CapturedMail = {};
  const server = net.createServer((socket) => {
    socket.setEncoding('utf8');
    let buffer = '';
    let inMessageData = false;

    socket.write('220 CashQuote test SMTP\r\n');

    const writeOk = () => socket.write('250 OK\r\n');
    const handleLine = (line: string) => {
      if (inMessageData) {
        if (line === '.') {
          inMessageData = false;
          writeOk();
        }
        return;
      }

      const command = line.toUpperCase();
      if (command.startsWith('EHLO') || command.startsWith('HELO')) {
        socket.write('250-localhost\r\n250-PIPELINING\r\n250 SIZE 10485760\r\n');
      } else if (command.startsWith('MAIL FROM:')) {
        mail.from = line.slice(line.indexOf(':') + 1).trim();
        writeOk();
      } else if (command.startsWith('RCPT TO:')) {
        mail.to = line.slice(line.indexOf(':') + 1).trim();
        writeOk();
      } else if (command === 'DATA') {
        inMessageData = true;
        socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');
      } else if (command === 'QUIT') {
        socket.write('221 Bye\r\n');
        socket.end();
      } else {
        writeOk();
      }
    };

    socket.on('data', (chunk: string) => {
      buffer += chunk;
      let lineBreak = buffer.indexOf('\r\n');
      while (lineBreak >= 0) {
        const line = buffer.slice(0, lineBreak);
        buffer = buffer.slice(lineBreak + 2);
        handleLine(line);
        lineBreak = buffer.indexOf('\r\n');
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('SMTP capture server did not expose a TCP address');
  }

  return { server, port: address.port, mail };
};

describe('SMTP reminder delivery integration', () => {
  const originalEnv = process.env;
  let capture: CaptureServer | undefined;

  beforeEach(async () => {
    process.env = {
      ...originalEnv,
      SMTP_FROM: 'billing@example.com',
    };
    capture = await startSmtpCapture();
    process.env.SMTP_URL = `smtp://127.0.0.1:${capture.port}`;
  });

  afterEach(async () => {
    process.env = originalEnv;
    if (capture?.server.listening) {
      await new Promise<void>((resolve, reject) => {
        capture?.server.close((error) => (error ? reject(error) : resolve()));
      });
    }
    capture = undefined;
  });

  it('accepts a reminder addressed to the client recipient', async () => {
    await new SmtpMailService().sendReminder({
      to: 'client@example.com',
      businessId: 'biz-1',
      entityId: 'invoice-1',
      entityType: 'invoice',
    });

    expect(capture?.mail).toEqual({
      from: '<billing@example.com>',
      to: '<client@example.com>',
    });
  });
});
