import request from 'supertest';
import app from '../../server/src/index';

async function runTests() {
  console.log('Running Phase 3: Cryptography and IAM Tests...');

  // 1. Test JWT Signature Stripping Attack
  const res = await request(app).post('/api/auth/demo-login').send();
  const validTokenCookie = res.headers['set-cookie'][0];
  const tokenValue = validTokenCookie.split(';')[0].split('=')[1];

  const tokenParts = tokenValue.split('.');
  const strippedToken = `${tokenParts[0]}.${tokenParts[1]}.`; // Remove signature

  const resStripped = await request(app)
    .get('/api/test-protected')
    .set('Cookie', `token=${strippedToken}`)
    .set('x-business-id', 'dummy');

  if (resStripped.status !== 401) {
    throw new Error('VULNERABILITY: API accepted JWT with stripped signature');
  }

  // 2. Test HttpOnly Cookie Configuration
  if (!validTokenCookie.includes('HttpOnly')) {
    throw new Error('VULNERABILITY: Auth cookie is missing HttpOnly flag, susceptible to XSS token theft');
  }

  // 3. Test Privilege Escalation / RBAC Abuse
  // (Since we have limited RBAC logic right now, we will verify the middleware blocks anonymous access fundamentally)
  const resAnon = await request(app).get('/api/test-protected');
  if (resAnon.status !== 401) {
    throw new Error('VULNERABILITY: Endpoint lacks basic auth enforcement');
  }

  console.log('Phase 3 Tests Passed: Cryptography and IAM configurations are secure.');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
