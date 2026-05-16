import request from 'supertest';
import app from '../../server/src/index';
import { prisma } from 'db';

async function runTests() {
  console.log('Running Quote Conversion Integration Tests...');

  // 1. Auth setup
  const authRes = await request(app).post('/api/auth/demo-login').send();
  const tokenCookie = authRes.headers['set-cookie'][0];
  const businessId = authRes.body.business.id;

  // 2. Create Client
  const clientRes = await request(app)
    .post('/api/clients')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      name: 'Conversion Test Client',
    });
  const clientId = clientRes.body.id;

  // 3. Create Quote
  const quoteRes = await request(app)
    .post('/api/quotes')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      clientId,
      status: 'accepted',
      lineItems: [
        { description: 'Conversion Item', quantity: 1, price: 5000 },
      ]
    });

  if (quoteRes.status !== 201) throw new Error(`Create Quote failed: ${JSON.stringify(quoteRes.body)}`);
  const quoteId = quoteRes.body.id;

  // 4. Test Conversion
  const convertRes = await request(app)
    .post(`/api/quotes/${quoteId}/convert`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send();

  if (convertRes.status !== 201) throw new Error(`Convert Quote failed: ${JSON.stringify(convertRes.body)}`);

  // Verify invoice
  if (convertRes.body.status !== 'unpaid') throw new Error(`Invoice status wrong: ${convertRes.body.status}`);
  if (convertRes.body.subtotal !== 5000) throw new Error(`Invoice subtotal wrong: ${convertRes.body.subtotal}`);

  // Verify activity log
  const log = await prisma.activityLog.findFirst({
    where: { entityId: quoteId, action: 'convert_quote_to_invoice' }
  });
  if (!log) throw new Error('Activity log not created during conversion transaction');

  // Verify Radar picks up unconverted quotes correctly (this one IS converted, so it should not show)
  const radarRes = await request(app)
    .get('/api/radar/insights')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send();

  if (radarRes.body.unconvertedQuotes.find((q: { id: string }) => q.id === quoteId)) {
    throw new Error('Radar should not return a converted quote');
  }

  // 5. Cleanup
  await prisma.client.delete({ where: { id: clientId } });

  console.log('Quote Conversion Integration tests passed!');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
