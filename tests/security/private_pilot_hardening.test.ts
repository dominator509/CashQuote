import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/src/index';
import { getJwtSecret } from '../../server/src/config/env';
import { prisma } from 'db';

jest.mock('db', () => ({
  prisma: {
    user: { findFirst: jest.fn(), create: jest.fn() },
    business: { findFirst: jest.fn(), create: jest.fn() },
    businessMember: { findFirst: jest.fn(), findUnique: jest.fn(), upsert: jest.fn() },
    activityLog: { create: jest.fn(), findMany: jest.fn() },
    $queryRaw: jest.fn(),
    $disconnect: jest.fn(),
  },
}));

describe('private pilot production hardening', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/cashquote',
      APP_ORIGIN: 'http://localhost:5173',
      CORS_ORIGIN: 'http://localhost:5173',
      PILOT_ACCESS_CODE: 'private-pilot-code-12345',
      PILOT_EMAIL_ALLOWLIST: 'pilot@example.com',
      SMTP_URL: 'smtp://localhost:1025',
      SMTP_FROM: 'billing@example.com',
    };
    (prisma.activityLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('blocks demo login in production unless explicitly allowed', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_DEMO_LOGIN;

    const response = await request(app).post('/api/auth/demo-login').send();

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('DEMO_LOGIN_DISABLED');
  });

  it('allows pilot login for an allowlisted email and provisions owner membership', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'pilot@example.com',
      role: 'owner',
    });
    (prisma.businessMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.business.create as jest.Mock).mockResolvedValue({ id: 'biz-1', name: 'pilot Pilot Business' });
    (prisma.businessMember.upsert as jest.Mock).mockResolvedValue({ id: 'member-1' });

    const response = await request(app)
      .post('/api/auth/pilot-login')
      .send({ email: 'pilot@example.com', accessCode: 'private-pilot-code-12345' });

    expect(response.status).toBe(200);
    expect(response.body.business.id).toBe('biz-1');
    expect(response.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('token=')])
    );
    expect(prisma.businessMember.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ role: 'owner' }),
      })
    );
    expect(prisma.business.findFirst).not.toHaveBeenCalled();
  });

  it('does not attach new pilot users to an existing business with the same generated name', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.user.create as jest.Mock).mockResolvedValue({
      id: 'user-2',
      email: 'pilot@other-domain.test',
      role: 'owner',
    });
    (prisma.businessMember.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.business.create as jest.Mock).mockResolvedValue({ id: 'biz-2', name: 'pilot Pilot Business' });
    (prisma.businessMember.upsert as jest.Mock).mockResolvedValue({ id: 'member-2' });
    process.env.PILOT_EMAIL_ALLOWLIST = 'pilot@other-domain.test';

    const response = await request(app)
      .post('/api/auth/pilot-login')
      .send({ email: 'pilot@other-domain.test', accessCode: 'private-pilot-code-12345' });

    expect(response.status).toBe(200);
    expect(response.body.business.id).toBe('biz-2');
    expect(prisma.business.create).toHaveBeenCalledWith({
      data: { name: 'pilot Pilot Business' },
    });
    expect(prisma.business.findFirst).not.toHaveBeenCalled();
  });

  it('rejects pilot login for non-allowlisted email', async () => {
    const response = await request(app)
      .post('/api/auth/pilot-login')
      .send({ email: 'other@example.com', accessCode: 'private-pilot-code-12345' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('EMAIL_NOT_ALLOWED');
  });

  it('omits validation internals from production error responses', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(app)
      .post('/api/auth/pilot-login')
      .send({ email: 'not-an-email', accessCode: 'private-pilot-code-12345' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
    });
  });

  it('returns stable production errors for malformed and oversized JSON bodies', async () => {
    process.env.NODE_ENV = 'production';

    const malformedResponse = await request(app)
      .post('/api/auth/pilot-login')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    const oversizedResponse = await request(app)
      .post('/api/auth/pilot-login')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ email: 'pilot@example.com', accessCode: 'private-pilot-code-12345', filler: 'x'.repeat(1024 * 1024) }));

    expect(malformedResponse.status).toBe(400);
    expect(malformedResponse.body).toEqual({
      error: 'Malformed JSON request body',
      code: 'MALFORMED_JSON',
    });
    expect(oversizedResponse.status).toBe(413);
    expect(oversizedResponse.body).toEqual({
      error: 'Request body is too large',
      code: 'PAYLOAD_TOO_LARGE',
    });
  });

  it('reports session context and clears the session cookie', async () => {
    const token = jwt.sign({ userId: 'user-1' }, getJwtSecret(), { expiresIn: '1h' });
    (prisma.user.findFirst as jest.Mock).mockResolvedValue({
      id: 'user-1',
      email: 'pilot@example.com',
      role: 'owner',
      memberships: [
        {
          role: 'owner',
          business: { id: 'biz-1', name: 'Pilot Business' },
        },
      ],
    });

    const meResponse = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', [`token=${token}`]);

    expect(meResponse.status).toBe(200);
    expect(meResponse.body.business.id).toBe('biz-1');
    expect(logoutResponse.status).toBe(204);
    expect(logoutResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('token=;')])
    );
  });

  it('rejects signed auth tokens that do not contain a usable user id', async () => {
    const token = jwt.sign({ sub: 'user-1' }, getJwtSecret(), { expiresIn: '1h' });

    const response = await request(app).get('/api/auth/me').set('Cookie', [`token=${token}`]);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('AUTH_INVALID');
  });

  it('requires owner role for activity log inspection', async () => {
    const token = jwt.sign({ userId: 'user-1' }, getJwtSecret(), { expiresIn: '1h' });
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValueOnce({
      role: 'member',
      business: { id: 'biz-1' },
    });

    const memberResponse = await request(app)
      .get('/api/activity-logs')
      .set('Cookie', [`token=${token}`])
      .set('x-business-id', 'biz-1');

    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValueOnce({
      role: 'owner',
      business: { id: 'biz-1' },
    });
    (prisma.activityLog.findMany as jest.Mock).mockResolvedValue([]);

    const ownerResponse = await request(app)
      .get('/api/activity-logs')
      .set('Cookie', [`token=${token}`])
      .set('x-business-id', 'biz-1');

    expect(memberResponse.status).toBe(403);
    expect(memberResponse.body.code).toBe('OWNER_REQUIRED');
    expect(ownerResponse.status).toBe(200);
    expect(ownerResponse.body.items).toEqual([]);
  });

  it('rejects cross-tenant access across protected route families', async () => {
    const token = jwt.sign({ userId: 'user-1' }, getJwtSecret(), { expiresIn: '1h' });
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue(null);

    const protectedRequests = [
      request(app).get('/api/clients'),
      request(app).get('/api/quotes'),
      request(app).get('/api/invoices'),
      request(app).get('/api/invoices/inv-1/payments'),
      request(app).get('/api/reminders'),
      request(app).get('/api/radar/insights'),
      request(app).post('/api/ai/generate').send({ notes: '1 hour of work' }),
      request(app).get('/api/activity-logs'),
    ];

    for (const protectedRequest of protectedRequests) {
      const response = await protectedRequest
        .set('Cookie', [`token=${token}`])
        .set('x-business-id', 'other-biz');
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('TENANT_FORBIDDEN');
    }
  });

  it('does not expose debug-only protected test routes', async () => {
    const token = jwt.sign({ userId: 'user-1' }, getJwtSecret(), { expiresIn: '1h' });
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue({
      role: 'owner',
      business: { id: 'biz-1' },
    });

    const response = await request(app)
      .get('/api/test-protected')
      .set('Cookie', [`token=${token}`])
      .set('x-business-id', 'biz-1');

    expect(response.status).toBe(404);
  });

  it('fails readiness when required production environment is missing', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.APP_ORIGIN;

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_MISSING');
  });

  it('fails readiness when production uses the development JWT secret', async () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'development-only-jwt-secret';

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_WEAK_SECRET');
  });

  it('fails readiness when production uses a weak pilot access code', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PILOT_ACCESS_CODE = 'pilot-code';

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_WEAK_ACCESS_CODE');
  });

  it('blocks production pilot login when the configured access code is weak', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PILOT_ACCESS_CODE = 'pilot-code';

    const response = await request(app)
      .post('/api/auth/pilot-login')
      .send({ email: 'pilot@example.com', accessCode: 'pilot-code' });

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_WEAK_ACCESS_CODE');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('fails readiness when production CORS origin is a wildcard', async () => {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = '*';

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_INVALID_ORIGIN');
  });

  it('fails readiness when production app origin is malformed', async () => {
    process.env.NODE_ENV = 'production';
    process.env.APP_ORIGIN = 'not-a-url';
    delete process.env.CORS_ORIGIN;

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_INVALID_ORIGIN');
  });

  it('passes readiness with production env and database connectivity', async () => {
    process.env.NODE_ENV = 'production';
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  it('fails readiness when production SMTP is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMTP_URL;
    delete process.env.SMTP_FROM;

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_MISSING');
    expect(response.body.error).toContain('SMTP_URL');
    expect(response.body.error).toContain('SMTP_FROM');
  });

  it('fails readiness when production proxy configuration is invalid', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TRUST_PROXY = 'all';

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_INVALID_TRUST_PROXY');
  });

  it('fails readiness when production SMTP URL is invalid', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SMTP_URL = 'https://mail.example.com';

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_INVALID_SMTP');
  });

  it('fails readiness when production mock email is enabled', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_MOCK_EMAIL = 'true';

    const response = await request(app).get('/readyz');

    expect(response.status).toBe(500);
    expect(response.body.code).toBe('CONFIG_MOCK_EMAIL_NOT_ALLOWED');
  });

  it('rate limits repeated auth attempts', async () => {
    let sawRateLimit = false;

    for (let index = 0; index < 30; index += 1) {
      const response = await request(app)
        .post('/api/auth/pilot-login')
        .send({ email: 'pilot@example.com', accessCode: 'wrong-code' });
      if (response.status === 429) {
        sawRateLimit = true;
        expect(response.body.code).toBe('RATE_LIMITED');
        break;
      }
    }

    expect(sawRateLimit).toBe(true);
  });
});
