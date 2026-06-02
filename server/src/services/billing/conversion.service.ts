import { prisma } from 'db';
import { AppError } from '../../middlewares/error';

export const convertQuoteToInvoice = async (quoteId: string, businessId: string) => {
  const quote = await prisma.quote.findFirst({
    where: { id: quoteId, businessId },
    include: { lineItems: true },
  });

  if (!quote) {
    throw new AppError('Quote not found', 404);
  }

  if (quote.status !== 'accepted') {
    throw new AppError('Only accepted quotes can be converted into invoices', 400);
  }

  // Idempotency check: Ensure we haven't already converted this quote
  const existingLog = await prisma.activityLog.findFirst({
    where: {
      businessId,
      entityId: quote.id,
      action: 'convert_quote_to_invoice'
    }
  });

  if (existingLog) {
    throw new AppError('Quote has already been converted to an invoice', 409); // Conflict
  }

  return prisma.$transaction(async (tx: any) => {
    // Create the invoice matching the quote totals
    const invoice = await tx.invoice.create({
      data: {
        businessId,
        clientId: quote.clientId,
        status: 'unpaid',
        subtotal: quote.subtotal,
        tax: quote.tax,
        discount: quote.discount,
        total: quote.total,
        lineItems: {
          create: quote.lineItems.map((item: any) => ({
            businessId,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            category: item.category,
          })),
        },
      },
      include: { lineItems: true, client: true },
    });

    // Log the conversion
    await tx.activityLog.create({
      data: {
        businessId,
        action: 'convert_quote_to_invoice',
        entityId: quote.id,
        entityType: 'quote',
        details: `Converted quote ${quote.id} to invoice ${invoice.id}`,
      },
    });

    return invoice;
  });
};
