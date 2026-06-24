import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../server/src/index';
import { getJwtSecret } from '../../server/src/config/env';
import { prisma } from 'db';

jest.mock('db', () => ({
  prisma: {
    businessMember: { findUnique: jest.fn() },
    aiRequest: { create: jest.fn() },
    activityLog: { create: jest.fn() },
  },
}));

describe('AI API hardening behavior', () => {
  const token = jwt.sign({ userId: 'user-1' }, getJwtSecret(), { expiresIn: '1h' });
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    (prisma.businessMember.findUnique as jest.Mock).mockResolvedValue({
      business: { id: 'biz-1' },
    });
    (prisma.aiRequest.create as jest.Mock).mockResolvedValue({ id: 'req-1' });
    (prisma.activityLog.create as jest.Mock).mockResolvedValue({ id: 'log-1' });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('logs a degraded AI fallback activity on API-level OpenAI miss path', async () => {
    delete process.env.OPENAI_API_KEY;

    const response = await request(app)
      .post('/api/ai/generate')
      .set('Cookie', [`token=${token}`])
      .set('x-business-id', 'biz-1')
      .send({ notes: 'Estimate for weekend electrical work' });

    expect(response.status).toBe(200);
    expect(response.body.provider).toBe('mock');
    expect(response.body.degraded).toBe(true);

    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          action: 'ai_degraded_fallback',
          entityType: 'ai_request',
        }),
      })
    );
    expect(prisma.aiRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'biz-1',
          status: 'degraded',
        }),
      })
    );
  });
});
