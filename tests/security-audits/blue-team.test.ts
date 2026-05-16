import request from 'supertest';
import app from '../../server/src/index';
import { prisma } from 'db';
import { v4 as uuidv4 } from 'uuid';

async function runTests() {
  console.log('Running Blue Team Tenant Isolation Tests...');

  // Create Business A and Auth
  const bizA = await prisma.business.create({ data: { name: 'Business A' } });
  await prisma.user.create({ data: { email: `userA-${uuidv4()}@test.com` } });
  const authResA = await request(app).post('/api/auth/demo-login').send();
  const tokenA = authResA.headers['set-cookie'][0];

  // Create Business B and Auth
  const bizB = await prisma.business.create({ data: { name: 'Business B' } });

  // Create a client in Business B
  const clientB = await prisma.client.create({
    data: { name: 'Client B', businessId: bizB.id }
  });

  // Attempt to access Business B's client using Business A's scoped session
  const res = await request(app)
    .get(`/api/clients/${clientB.id}`)
    .set('Cookie', tokenA)
    .set('x-business-id', bizA.id);

  if (res.status === 200) {
    throw new Error('CRITICAL VULNERABILITY: Cross-tenant data leakage detected. Business A accessed Business B client.');
  }

  if (res.status !== 404) {
    throw new Error(`Expected 404 Not Found due to businessId scoping, got ${res.status}`);
  }

  console.log('Blue Team tests passed! Multi-tenant scoping blocks cross-tenant reads when scoped correctly.');
  process.exit(0);
}

runTests().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
