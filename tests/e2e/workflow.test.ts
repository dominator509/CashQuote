import request from 'supertest';
import app from '../../server/src/index';

async function runE2e() {
  console.log('Running E2E Simulated Client API Workflow...');

  // 1. App loads, calls /api/auth/demo-login
  const authRes = await request(app).post('/api/auth/demo-login').send();
  const tokenCookie = authRes.headers['set-cookie'][0];
  const businessId = authRes.body.business.id;

  // 2. User goes to clients, creates client
  const clientRes = await request(app)
    .post('/api/clients')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({ name: 'E2E Target Client' });
  const clientId = clientRes.body.id;

  // 3. User navigates to Quote Builder, writes notes, calls AI Copilot
  const aiRes = await request(app)
    .post('/api/ai/generate')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({ notes: 'Did 10 hours of dev at 50/hr' });

  const aiItems = aiRes.body.items;

  // 4. User saves Quote with AI items
  const quoteRes = await request(app)
    .post('/api/quotes')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      clientId,
      lineItems: aiItems, // Will dynamically calculate math
    });
  const quoteId = quoteRes.body.id;

  // 5. User Accepts Quote and converts to Invoice
  await request(app)
    .put(`/api/quotes/${quoteId}`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({ status: 'accepted' });

  const convertRes = await request(app)
    .post(`/api/quotes/${quoteId}/convert`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send();

  if (convertRes.body.status !== 'unpaid') throw new Error('Conversion failed in E2E');

  console.log('E2E Simulated UI Workflow passed successfully!');
  process.exit(0);
}

runE2e().catch(e => {
  console.error('E2E Test Failed:', e);
  process.exit(1);
});
