import { prisma } from 'db';
import { getLostCashInsights } from '../../server/src/services/radar/radar.service';

jest.mock('db', () => ({
  prisma: {
    quote: { findMany: jest.fn() },
    invoice: { findMany: jest.fn() }
  }
}));

describe('Phase 2: Data Flow & State Tracking Validation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should track state transformations through getLostCashInsights', async () => {
    const businessId = 'test-business-id';

    // Setup Mock Data
    const mockQuotes = [
      { id: 'q1', businessId, status: 'accepted', total: 1000 },
      { id: 'q2', businessId, status: 'accepted', total: 500 }
    ];

    const mockInvoices = [
      { id: 'i1', businessId, status: 'unpaid', total: 200, dueDate: new Date(Date.now() - 100000) }
    ];

    (prisma.quote.findMany as jest.Mock).mockResolvedValue(mockQuotes);
    (prisma.invoice.findMany as jest.Mock)
      .mockResolvedValueOnce([{ sourceQuoteId: 'q1' }])
      .mockResolvedValueOnce(mockInvoices);

    const result = await getLostCashInsights(businessId);

    // Validate internal structural data flow:
    // q1 is converted, so it should be filtered out. q2 should remain.
    expect(result.unconvertedQuotes).toHaveLength(1);
    expect(result.unconvertedQuotes[0].id).toBe('q2');

    expect(result.overdueInvoices).toHaveLength(1);
    expect(result.overdueInvoices[0].id).toBe('i1');

    // Validate total reduction
    expect(result.totalAtRisk).toBe(500 + 200); // q2.total + i1.total
    expect(prisma.invoice.findMany).toHaveBeenNthCalledWith(1, {
      where: {
        businessId,
        sourceQuoteId: { in: ['q1', 'q2'] },
      },
      select: { sourceQuoteId: true },
    });
  });
});
