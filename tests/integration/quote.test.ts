import request from 'supertest';
import app from '../../server/src/index';
import { prisma } from 'db';

async function runTests() {
  console.log('Running Quote Integration Tests...');

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
      name: 'Integration Test Client',
      email: 'client@test.com'
    });

  if (clientRes.status !== 201) throw new Error(`Create Client failed: ${JSON.stringify(clientRes.body)}`);
  const clientId = clientRes.body.id;

  // 3. Create Quote
  const quoteRes = await request(app)
    .post('/api/quotes')
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      clientId,
      taxRatePercent: 10,
      discountAmount: 1000,
      lineItems: [
        { description: 'Item 1', quantity: 2, price: 5000 }, // subtotal: 10000
        { description: 'Item 2', quantity: 1, price: 1000 }  // subtotal: 11000
      ]
    });

  if (quoteRes.status !== 201) throw new Error(`Create Quote failed: ${JSON.stringify(quoteRes.body)}`);

  // Verify totals on creation: Subtotal: 11000, Discount: 1000, Taxable: 10000, Tax 10%: 1000, Total: 11000
  if (quoteRes.body.subtotal !== 11000) throw new Error(`Quote Subtotal incorrect: ${quoteRes.body.subtotal}`);
  if (quoteRes.body.total !== 11000) throw new Error(`Quote Total incorrect: ${quoteRes.body.total}`);

  const quoteId = quoteRes.body.id;

  // 4. Update Quote (Add items)
  const updateRes = await request(app)
    .put(`/api/quotes/${quoteId}`)
    .set('Cookie', tokenCookie)
    .set('x-business-id', businessId)
    .send({
      taxRatePercent: 10, // Pass taxRatePercent again since it's not stored on the model for now
      lineItems: [
        { description: 'Item 3', quantity: 1, price: 2000 }
      ]
    });

  if (updateRes.status !== 200) throw new Error(`Update Quote failed: ${JSON.stringify(updateRes.body)}`);

  // Subtotal: 2000, Discount: 1000, Taxable: 1000, Tax 10%: 100, Total: 1100
  if (updateRes.body.subtotal !== 2000) throw new Error(`Updated Subtotal incorrect: ${updateRes.body.subtotal}`);
  if (updateRes.body.total !== 1100) throw new Error(`Updated Total incorrect: ${updateRes.body.total}`);

  // 5. Cleanup
  await prisma.client.delete({ where: { id: clientId } }); // Cascades quote

  console.log('All Quote Integration tests passed!');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
