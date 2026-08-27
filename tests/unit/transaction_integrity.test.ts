import { prisma } from 'db';
import { runSerializableTransaction } from '../../server/src/services/billing/transaction.service';

jest.mock('db', () => ({
  prisma: {
    $transaction: jest.fn(),
  },
}));

describe('serializable transaction helper', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('retries PostgreSQL serialization failures with serializable isolation', async () => {
    (prisma.$transaction as jest.Mock)
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async (callback) => callback(prisma));

    const result = await runSerializableTransaction(async () => 'committed');

    expect(result).toBe('committed');
    expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    expect(prisma.$transaction).toHaveBeenLastCalledWith(
      expect.any(Function),
      { isolationLevel: 'Serializable' }
    );
  });
});
