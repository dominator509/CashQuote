import net from 'node:net';
import { prisma } from 'db';
import { SmtpMailService } from '../../server/src/services/mail/smtp-mail.service';
import { sendReminder } from '../../server/src/services/reminders/reminder.service';

jest.mock('db', () => ({
  prisma: {
    reminder: { findFirst: jest.fn(), update: jest.fn() },
    quote: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    activityLog: { create: jest.fn() },
    $transaction: jest.fn(async (callback) => callback(prisma)),
  },
}));

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
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      SMTP_FROM: 'billing@example.com',
    };
    capture = await startSmtpCapture();
    process.env.SMTP_URL = `smtp://127.0.0.1:${capture.port}`;

    (prisma.reminder.findFirst as jest.Mock).mockResolvedValue({
      id: 'rem-1',
      status: 'pending',
      entityId: 'quote-1',
      entityType: 'quote',
      scheduledAt: new Date().toISOString(),
    });
    (prisma.quote.findFirst as jest.Mock).mockResolvedValue({
      id: 'quote-1',
      client: { email: 'client@example.com' },
    });
    (prisma.reminder.update as jest.Mock).mockImplementation(async ({ data }) => ({
      id: 'rem-1',
      status: data.status,
    }));
    (prisma.activityLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
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

  it('resolves the client recipient and persists sent after SMTP acceptance', async () => {
    const sent = await sendReminder('biz-1', 'user-1', 'rem-1');

    expect(sent).toEqual({ id: 'rem-1', status: 'sent' });
    expect(capture?.mail).toEqual({
      from: '<billing@example.com>',
      to: '<client@example.com>',
    });
    expect(prisma.reminder.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'rem-1', businessId: 'biz-1', status: 'pending' },
      data: { status: 'sending' },
    });
    expect(prisma.reminder.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'rem-1', businessId: 'biz-1', status: 'sending' },
      data: { status: 'sent' },
    });
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        businessId: 'biz-1',
        userId: 'user-1',
        action: 'reminder_send',
        entityId: 'rem-1',
        entityType: 'reminder',
      }),
    });
  });
});
