import { prisma } from 'db';

export const getLostCashInsights = async (businessId: string) => {
  // 1. Find accepted quotes (heuristic: no associated activity log converting them yet)
  const acceptedQuotes = await prisma.quote.findMany({
    where: {
      businessId,
      status: 'accepted'
    },
    include: { client: true }
  });

  const convertedLogIds = await prisma.activityLog.findMany({
    where: {
      businessId,
      action: 'convert_quote_to_invoice',
      entityId: { in: acceptedQuotes.map((q: any) => q.id) }
    }
  }).then((logs: any) => new Set(logs.map((l: any) => l.entityId)));

  const unconvertedQuotes = acceptedQuotes.filter((q: any) => !convertedLogIds.has(q.id));

  // 2. Find overdue unpaid invoices
  const now = new Date();
  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      businessId,
      status: 'unpaid',
      dueDate: { lt: now }
    },
    include: { client: true }
  });

  return {
    unconvertedQuotes,
    overdueInvoices,
    totalAtRisk:
      unconvertedQuotes.reduce((acc, q) => acc + q.total, 0) +
      overdueInvoices.reduce((acc, i) => acc + i.total, 0)
  };
};
