import request from 'supertest';
import app from '../../server/src/index';

async function runTests() {
  console.log('Running Diagnostic Bug Repro Tests...');

  const authRes = await request(app).post('/api/auth/demo-login').send();
  const tokenCookie = authRes.headers['set-cookie'][0];
  const businessId = authRes.body.business.id;

  const clientRes = await request(app)
    .post('/api/clients')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({ name: 'Bug Repro Client' });
  const clientId = clientRes.body.id;

  // 1. Repro Tax Erasure Bug
  const quoteRes = await request(app)
    .post('/api/quotes')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      clientId,
      taxRatePercent: 10,
      lineItems: [ { description: 'Test', quantity: 1, price: 1000 } ] // subtotal 1000, tax 100, total 1100
    });

  if (quoteRes.body.total !== 1100) throw new Error(`Initial quote math failed`);

  const quoteId = quoteRes.body.id;

  // Update without passing taxRatePercent
  const updateRes = await request(app)
    .put(`/api/quotes/${quoteId}`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      lineItems: [ { description: 'Updated Test', quantity: 1, price: 1000 } ]
    });

  // If the bug exists, taxRatePercent falls back to 0, wiping out the 100 tax, leaving total as 1000
  if (updateRes.body.total === 1000) {
    throw new Error('BUG CONFIRMED: Updating a quote without passing taxRatePercent destructively resets tax to 0.');
  } else if (updateRes.body.total === 1100) {
    console.log('Math is intact.');
  } else {
    throw new Error('Unexpected math behavior during update');
  }

  // 2. Repro Idempotency Bug
  await request(app)
    .put(`/api/quotes/${quoteId}`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({ status: 'accepted' });

  const convertRes1 = await request(app)
    .post(`/api/quotes/${quoteId}/convert`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send();

  if (convertRes1.status !== 201) throw new Error('First conversion failed');

  const convertRes2 = await request(app)
    .post(`/api/quotes/${quoteId}/convert`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send();

  if (convertRes2.status === 201) {
    throw new Error('BUG CONFIRMED: Convert endpoint is not idempotent. Multiple invoices generated from a single quote.');
  } else if (convertRes2.status === 409) {
    console.log('Idempotency intact.');
  } else {
    throw new Error(`Unexpected idempotency behavior: ${convertRes2.status}`);
  }

  console.log('All bug repros passed successfully. System is robust.');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
