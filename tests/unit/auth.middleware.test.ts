import request from 'supertest';
import app from '../../server/src/index';

async function runTests() {
  console.log('Running Auth & Tenant Middleware Tests...');

  const res = await request(app).post('/api/auth/demo-login').send();
  const validTokenCookie = res.headers['set-cookie'][0];
  const validBusinessId = res.body.business.id;

  const res1 = await request(app)
    .get('/api/test-protected')
    .set('x-business-id', validBusinessId);
  if (res1.status !== 401) throw new Error(`Expected 401, got ${res1.status}`);

  const res2 = await request(app)
    .get('/api/test-protected')
    .set('Cookie', 'token=invalidtoken123')
    .set('x-business-id', validBusinessId);
  if (res2.status !== 401) throw new Error(`Expected 401, got ${res2.status}`);

  const res3 = await request(app)
    .get('/api/test-protected')
    .set('Cookie', validTokenCookie);
  if (res3.status !== 400) throw new Error(`Expected 400, got ${res3.status}`);

  const res4 = await request(app)
    .get('/api/test-protected')
    .set('Cookie', validTokenCookie)
    .set('x-business-id', 'invalid-business-id-uuid');
  if (res4.status !== 403) throw new Error(`Expected 403, got ${res4.status}`);

  const res5 = await request(app)
    .get('/api/test-protected')
    .set('Cookie', validTokenCookie)
    .set('x-business-id', validBusinessId);
  if (res5.status !== 200) throw new Error(`Expected 200, got ${res5.status}`);

  console.log('All middleware tests passed!');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
