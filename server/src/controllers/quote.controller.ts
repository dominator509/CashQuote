import { Request, Response } from 'express';
import { prisma } from 'db';
import { AppError } from '../middlewares/error';
import { calculateLineItemsSubtotal, calculateTotals } from '../services/billing/math.service';
import { createQuoteSchema, updateQuoteSchema } from 'shared';
import { convertQuoteToInvoice as convertService } from '../services/billing/conversion.service';

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

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, businessId },
  });

  if (!client) {
    throw new AppError('Client not found or belongs to another business', 404);
  }

  const subtotal = calculateLineItemsSubtotal(data.lineItems);
  const totals = calculateTotals(subtotal, data.taxRatePercent, data.discountAmount);

  const quote = await prisma.quote.create({
    data: {
      businessId,
      clientId: data.clientId,
      status: data.status || 'draft',
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      lineItems: {
        create: data.lineItems.map(item => ({
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

  res.status(201).json(quote);
};

export const updateQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;
  const data = updateQuoteSchema.parse(req.body);

  const existingQuote = await prisma.quote.findFirst({
    where: { id, businessId },
    include: { lineItems: true },
  });

  if (!existingQuote) {
    throw new AppError('Quote not found', 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Process Line Items if provided
    let currentLineItems = existingQuote.lineItems;
    if (data.lineItems) {
      // Delete old ones
      await tx.quoteLineItem.deleteMany({
        where: { quoteId: id, businessId },
      });
      // Insert new ones
      if (data.lineItems.length > 0) {
        await tx.quoteLineItem.createMany({
          data: data.lineItems.map(item => ({
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

    // 2. Recalculate Totals
    const subtotal = calculateLineItemsSubtotal(currentLineItems);
    const discountAmount = data.discountAmount ?? existingQuote.discount;

    // Derive effective tax rate if not provided:
    // oldTax = round((oldSubtotal - oldDiscount) * oldRate / 100)
    // oldRate ≈ (oldTax * 100) / (oldSubtotal - oldDiscount)
    let taxRatePercent = data.taxRatePercent;
    if (taxRatePercent === undefined) {
      const oldTaxable = existingQuote.subtotal - existingQuote.discount;
      taxRatePercent = oldTaxable > 0 ? (existingQuote.tax * 100) / oldTaxable : 0;
    }

    const totals = calculateTotals(subtotal, taxRatePercent, discountAmount);

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

  res.json(result);
};

export const deleteQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const quote = await prisma.quote.findFirst({
    where: { id, businessId },
  });

  if (!quote) {
    throw new AppError('Quote not found', 404);
  }

  await prisma.quote.delete({
    where: { id },
  });

  res.status(204).send();
};

export const convertQuote = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const invoice = await convertService(id, businessId);
  res.status(201).json(invoice);
};
