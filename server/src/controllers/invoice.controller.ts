import { Request, Response } from 'express';
import { prisma } from 'db';
import { AppError } from '../middlewares/error';
import { calculateLineItemsSubtotal, calculateTotals } from '../services/billing/math.service';
import { createInvoiceSchema, updateInvoiceSchema } from 'shared';

export const getInvoices = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const invoices = await prisma.invoice.findMany({
    where: { businessId },
    include: { lineItems: true, client: true, payments: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
};

export const getInvoiceById = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: { lineItems: true, client: true, payments: true },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  res.json(invoice);
};

export const createInvoice = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const data = createInvoiceSchema.parse(req.body);

  const client = await prisma.client.findFirst({
    where: { id: data.clientId, businessId },
  });

  if (!client) {
    throw new AppError('Client not found or belongs to another business', 404);
  }

  const subtotal = calculateLineItemsSubtotal(data.lineItems);
  const totals = calculateTotals(subtotal, data.taxRatePercent, data.discountAmount);

  const invoice = await prisma.invoice.create({
    data: {
      businessId,
      clientId: data.clientId,
      status: data.status || 'unpaid',
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
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

  res.status(201).json(invoice);
};

export const updateInvoice = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;
  const data = updateInvoiceSchema.parse(req.body);

  const existingInvoice = await prisma.invoice.findFirst({
    where: { id, businessId },
    include: { lineItems: true },
  });

  if (!existingInvoice) {
    throw new AppError('Invoice not found', 404);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Process Line Items if provided
    let currentLineItems = existingInvoice.lineItems;
    if (data.lineItems) {
      // Delete old ones
      await tx.invoiceLineItem.deleteMany({
        where: { invoiceId: id, businessId },
      });
      // Insert new ones
      if (data.lineItems.length > 0) {
        await tx.invoiceLineItem.createMany({
          data: data.lineItems.map(item => ({
            invoiceId: id,
            businessId,
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            category: item.category,
          })),
        });
      }
      // Re-fetch
      currentLineItems = await tx.invoiceLineItem.findMany({
        where: { invoiceId: id, businessId },
      });
    }

    // 2. Recalculate Totals
    const subtotal = calculateLineItemsSubtotal(currentLineItems);
    const taxRatePercent = data.taxRatePercent ?? 0;
    const discountAmount = data.discountAmount ?? existingInvoice.discount;

    const totals = calculateTotals(subtotal, taxRatePercent, discountAmount);

    // 3. Update Invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id },
      data: {
        status: data.status,
        subtotal: totals.subtotal,
        tax: totals.tax,
        discount: totals.discount,
        total: totals.total,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
      },
      include: { lineItems: true, client: true },
    });

    return updatedInvoice;
  });

  res.json(result);
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, businessId },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  await prisma.invoice.delete({
    where: { id },
  });

  res.status(204).send();
};
