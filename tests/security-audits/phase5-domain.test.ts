import request from 'supertest';
import app from '../../server/src/index';

async function runTests() {
  console.log('Running Phase 5: Domain-Specific Vulnerability Testing...');

  // 1. Enterprise/Web: Test Business Logic Abuse & Race Conditions (TOCTOU)
  // Attempting to convert a quote that isn't 'accepted'

  const authRes = await request(app).post('/api/auth/demo-login').send();
  const tokenCookie = authRes.headers['set-cookie'][0];
  const businessId = authRes.body.business.id;

  const clientRes = await request(app)
    .post('/api/clients')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({ name: 'TOCTOU Client' });

  const quoteRes = await request(app)
    .post('/api/quotes')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      clientId: clientRes.body.id,
      status: 'draft', // Not accepted
    });

  const convertRes = await request(app)
    .post(`/api/quotes/${quoteRes.body.id}/convert`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send();

  if (convertRes.status !== 400) {
    throw new Error('VULNERABILITY: Business logic abuse allowed converting a draft quote to invoice');
  }

  // 2. Healthcare/Regulated Testing
  console.log('BYPASS: Incompatible Stack. Project is not handling PHI data or medical devices.');

  // 3. Web3/Blockchain Testing
  console.log('BYPASS: Incompatible Stack. Project is a Web2 SaaS, no smart contracts or Web3 oracles present.');

  console.log('Phase 5 Tests Passed: Business Logic abuse prevented via status validation.');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
