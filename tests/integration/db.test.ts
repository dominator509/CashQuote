import * as dotenv from 'dotenv';
dotenv.config();
import { prisma } from 'db';

async function main() {
  try {
    const business = await prisma.business.create({
      data: {
        name: 'Test Business',
      },
    });
    console.log('Created business:', business.name);

    const client = await prisma.client.create({
      data: {
        businessId: business.id,
        name: 'Test Client',
      },
    });
    console.log('Created client:', client.name);

    // Verify constraints
    const fetchedBusiness = await prisma.business.findUnique({
      where: { id: business.id },
      include: { clients: true },
    });

    if (fetchedBusiness?.clients[0]?.id === client.id) {
       console.log('Foreign key constraint working perfectly.');
    } else {
       throw new Error('Relation missing');
    }

    // Cleanup
    await prisma.business.delete({ where: { id: business.id } });
    console.log('Cleaned up records');

    process.exit(0);
  } catch (error) {
    console.error('Database test failed:', error);
    process.exit(1);
  }
}

main();
