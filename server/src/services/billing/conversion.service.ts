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

  // Check if it has already been converted (we will assume an invoice with the same totals and client created recently is a match, or we could add an invoiceId to Quote in V2. For now, we just create the invoice).

  return prisma.$transaction(async (tx) => {
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
          create: quote.lineItems.map(item => ({
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
