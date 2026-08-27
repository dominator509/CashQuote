import { prisma } from 'db';

export const getLostCashInsights = async (businessId: string) => {
  // 1. Find accepted quotes that do not have an invoice conversion link.
  const acceptedQuotes = await prisma.quote.findMany({
    where: {
      businessId,
      status: 'accepted'
    },
    include: { client: true }
  });

  const acceptedQuoteIds = acceptedQuotes.map((quote) => quote.id);
  const convertedQuoteIds =
    acceptedQuoteIds.length === 0
      ? new Set<string>()
      : await prisma.invoice
          .findMany({
            where: {
              businessId,
              sourceQuoteId: { in: acceptedQuoteIds },
            },
            select: { sourceQuoteId: true },
          })
          .then(
            (invoices) =>
              new Set(
                invoices
                  .map((invoice) => invoice.sourceQuoteId)
                  .filter((sourceQuoteId): sourceQuoteId is string => Boolean(sourceQuoteId))
              )
          );

  const unconvertedQuotes = acceptedQuotes.filter((quote) => !convertedQuoteIds.has(quote.id));

  // 2. Find overdue unpaid invoices
  const now = new Date();
  const overdueInvoiceRecords = await prisma.invoice.findMany({
    where: {
      businessId,
      status: 'unpaid',
      dueDate: { lt: now }
    },
    include: {
      client: true,
      payments: { select: { amount: true } },
    }
  });

  const overdueInvoices = overdueInvoiceRecords.map(({ payments, ...invoice }) => ({
    ...invoice,
    outstanding: Math.max(
      invoice.total - (payments ?? []).reduce((sum, payment) => sum + payment.amount, 0),
      0
    ),
  }));

  return {
    unconvertedQuotes,
    overdueInvoices,
    totalAtRisk:
      unconvertedQuotes.reduce((acc, q) => acc + q.total, 0) +
      overdueInvoices.reduce((acc, i) => acc + i.outstanding, 0)
  };
};
