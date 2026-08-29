import { AppError } from '../../middlewares/error';
import { runSerializableTransaction } from './transaction.service';

const isDuplicateConstraintError = (error: unknown): error is { code: string } => {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
};

export const convertQuoteToInvoice = async (quoteId: string, businessId: string) => {
  try {
    return await runSerializableTransaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id: quoteId, businessId },
        include: { lineItems: true },
      });

      if (!quote) {
        throw new AppError('Quote not found', 404);
      }

      if (quote.status !== 'accepted') {
        throw new AppError('Only accepted quotes can be converted into invoices', 400);
      }

      const existingInvoice = await tx.invoice.findUnique({
        where: { sourceQuoteId: quote.id },
        include: { lineItems: true, client: true },
      });

      if (existingInvoice) {
        throw new AppError('Quote has already been converted to an invoice', 409);
      }

      const invoice = await tx.invoice.create({
        data: {
          businessId,
          clientId: quote.clientId,
          sourceQuoteId: quote.id,
          status: 'unpaid',
          subtotal: quote.subtotal,
          tax: quote.tax,
          discount: quote.discount,
          total: quote.total,
          lineItems: {
            create: quote.lineItems.map((item) => ({
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
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    if (isDuplicateConstraintError(error)) {
      throw new AppError('Quote has already been converted to an invoice', 409);
    }

    throw error;
  }
};
