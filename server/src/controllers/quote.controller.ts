import { Request, Response } from 'express';
import { prisma } from 'db';
import { AppError } from '../middlewares/error';
import {
  calculateLineItemsSubtotal,
  calculateTotals,
  isDiscountWithinSubtotal,
} from '../services/billing/math.service';
import { createQuoteSchema, updateQuoteSchema } from 'shared';
import { convertQuoteToInvoice as convertService } from '../services/billing/conversion.service';
import { logActivity } from '../services/activity/activity.service';
import { runSerializableTransaction } from '../services/billing/transaction.service';
import { ACTIVE_REMINDER_STATUSES } from '../services/reminders/reminder-status';

export const getQuotes = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const quotes = await prisma.quote.findMany({
    where: { businessId },
    include: { lineItems: true, client: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(quotes);
};

export const getQuoteById = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: { lineItems: true, client: true },
  });

  if (!quote) {
    throw new AppError('Quote not found', 404);
  }

  res.json(quote);
};

export const createQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const data = createQuoteSchema.parse(req.body);

  const subtotal = calculateLineItemsSubtotal(data.lineItems);
  if (!isDiscountWithinSubtotal(subtotal, data.discountAmount)) {
    throw new AppError('Discount cannot exceed subtotal', 400, 'DISCOUNT_EXCEEDS_SUBTOTAL');
  }
  const totals = calculateTotals(subtotal, data.taxRatePercent, data.discountAmount);

  const quote = await runSerializableTransaction(async (tx) => {
    const client = await tx.client.findFirst({
      where: { id: data.clientId, businessId },
    });

    if (!client) {
      throw new AppError('Client not found or belongs to another business', 404);
    }

    return tx.quote.create({
      data: {
        businessId,
        clientId: data.clientId,
        status: data.status || 'draft',
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        lineItems: {
          create: data.lineItems.map((item) => ({
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
  });

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'quote_create',
    entityId: quote.id,
    entityType: 'quote',
  });

  res.status(201).json(quote);
};

export const updateQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;
  const data = updateQuoteSchema.parse(req.body);

  const result = await runSerializableTransaction(async (tx) => {
    const existingQuote = await tx.quote.findFirst({
      where: { id, businessId },
      include: { lineItems: true, _count: { select: { sourceInvoices: true } } },
    });

    if (!existingQuote) {
      throw new AppError('Quote not found', 404);
    }

    if ((existingQuote._count?.sourceInvoices ?? 0) > 0) {
      throw new AppError(
        'Quote has already been converted to an invoice and cannot be updated',
        409,
        'QUOTE_HAS_INVOICE'
      );
    }

    const hasLineItemUpdate = data.lineItems !== undefined;
    const hasDiscountUpdate = data.discountAmount !== undefined;

    // Status-only updates must preserve the persisted financial totals. The
    // stored tax amount is rounded, so it cannot be used to recover the exact
    // tax rate for a later line-item or discount change.
    if (!hasLineItemUpdate && !hasDiscountUpdate && data.taxRatePercent === undefined) {
      return tx.quote.update({
        where: { id },
        data: { status: data.status },
        include: { lineItems: true, client: true },
      });
    }

    const requestedLineItems = data.lineItems ?? existingQuote.lineItems;
    const subtotal = calculateLineItemsSubtotal(requestedLineItems);
    const discountAmount = data.discountAmount ?? existingQuote.discount;
    if (!isDiscountWithinSubtotal(subtotal, discountAmount)) {
      throw new AppError('Discount cannot exceed subtotal', 400, 'DISCOUNT_EXCEEDS_SUBTOTAL');
    }

    if ((hasLineItemUpdate || hasDiscountUpdate) && data.taxRatePercent === undefined) {
      throw new AppError(
        'Tax rate is required when updating quote financial details',
        400,
        'TAX_RATE_REQUIRED'
      );
    }

    // 1. Process Line Items if provided
    let currentLineItems = existingQuote.lineItems;
    const updatedLineItems = data.lineItems;
    if (updatedLineItems !== undefined) {
      // Delete old ones
      await tx.quoteLineItem.deleteMany({
        where: { quoteId: id, businessId },
      });
      // Insert new ones
      if (updatedLineItems.length > 0) {
        await tx.quoteLineItem.createMany({
          data: updatedLineItems.map((item) => ({
            quoteId: id,
            businessId,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            category: item.category,
          })),
        });
      }
      // Re-fetch to guarantee correct state for math
      currentLineItems = await tx.quoteLineItem.findMany({
        where: { quoteId: id, businessId },
      });
    }

    // 2. Recalculate Totals using the caller's explicit rate.
    const taxRatePercent = data.taxRatePercent ?? 0;
    const totals = calculateTotals(
      calculateLineItemsSubtotal(currentLineItems),
      taxRatePercent,
      discountAmount
    );

    // 3. Update Quote
    const updatedQuote = await tx.quote.update({
      where: { id },
      data: {
        status: data.status,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
      },
      include: { lineItems: true, client: true },
    });

    return updatedQuote;
  });

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'quote_update',
    entityId: result.id,
    entityType: 'quote',
  });

  res.json(result);
};

export const deleteQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  await runSerializableTransaction(async (tx) => {
    const quote = await tx.quote.findFirst({
      where: { id, businessId },
      include: { _count: { select: { sourceInvoices: true } } },
    });

    if (!quote) {
      throw new AppError('Quote not found', 404);
    }

    if (quote._count.sourceInvoices > 0) {
      throw new AppError(
        'Quote has been converted to an invoice and cannot be deleted',
        409,
        'QUOTE_HAS_INVOICE'
      );
    }

    const activeReminder = await tx.reminder.findFirst({
      where: {
        businessId,
        entityId: id,
        entityType: 'quote',
        status: { in: [...ACTIVE_REMINDER_STATUSES] },
      },
    });
    if (activeReminder) {
      throw new AppError(
        'Quote has active reminders and cannot be deleted',
        409,
        'QUOTE_HAS_ACTIVE_REMINDERS'
      );
    }

    await tx.quote.delete({
      where: { id },
    });
  });

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'quote_delete',
    entityId: id,
    entityType: 'quote',
  });

  res.status(204).send();
};

export const convertQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const invoice = await convertService(id, businessId);
  res.status(201).json(invoice);
};
