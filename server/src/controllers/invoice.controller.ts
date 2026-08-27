import { Request, Response } from 'express';
import { prisma } from 'db';
import { AppError } from '../middlewares/error';
import {
  calculateLineItemsSubtotal,
  calculateTotals,
  isDiscountWithinSubtotal,
} from '../services/billing/math.service';
import { createInvoiceSchema, updateInvoiceSchema } from 'shared';
import { logActivity } from '../services/activity/activity.service';
import { runSerializableTransaction } from '../services/billing/transaction.service';
import { ACTIVE_REMINDER_STATUSES } from '../services/reminders/reminder-status';

const deriveInvoiceStatus = (
  requestedStatus: 'unpaid' | 'paid' | 'void' | undefined,
  paidTotal: number,
  invoiceTotal: number
): 'unpaid' | 'paid' | 'void' => {
  if (requestedStatus === 'void') {
    return 'void';
  }

  return paidTotal >= invoiceTotal ? 'paid' : 'unpaid';
};

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
  if (!isDiscountWithinSubtotal(subtotal, data.discountAmount)) {
    throw new AppError('Discount cannot exceed subtotal', 400, 'DISCOUNT_EXCEEDS_SUBTOTAL');
  }
  const totals = calculateTotals(subtotal, data.taxRatePercent, data.discountAmount);

  const invoice = await prisma.invoice.create({
    data: {
      businessId,
      clientId: data.clientId,
      status: deriveInvoiceStatus(data.status, 0, totals.total),
      subtotal: totals.subtotal,
      tax: totals.tax,
      discount: totals.discount,
      total: totals.total,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
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

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'invoice_create',
    entityId: invoice.id,
    entityType: 'invoice',
  });

  res.status(201).json(invoice);
};

export const updateInvoice = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;
  const data = updateInvoiceSchema.parse(req.body);

  const result = await runSerializableTransaction(async (tx) => {
    const existingInvoice = await tx.invoice.findFirst({
      where: { id, businessId },
      include: { lineItems: true, payments: true },
    });

    if (!existingInvoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (existingInvoice.status === 'void') {
      throw new AppError('Void invoices cannot be updated', 409, 'INVOICE_IS_VOID');
    }

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
          data: data.lineItems.map((item) => ({
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
    const discountAmount = data.discountAmount ?? existingInvoice.discount;
    if (!isDiscountWithinSubtotal(subtotal, discountAmount)) {
      throw new AppError('Discount cannot exceed subtotal', 400, 'DISCOUNT_EXCEEDS_SUBTOTAL');
    }

    let taxRatePercent = data.taxRatePercent;
    if (taxRatePercent === undefined) {
      const oldTaxable = existingInvoice.subtotal - existingInvoice.discount;
      taxRatePercent = oldTaxable > 0 ? (existingInvoice.tax * 100) / oldTaxable : 0;
    }

    const totals = calculateTotals(subtotal, taxRatePercent, discountAmount);
    const paidTotal = existingInvoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidTotal > totals.total) {
      throw new AppError('Invoice total cannot be less than recorded payments', 400);
    }
    const nextStatus = deriveInvoiceStatus(data.status, paidTotal, totals.total);

    // 3. Update Invoice
    const updatedInvoice = await tx.invoice.update({
      where: { id },
      data: {
        status: nextStatus,
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

  await logActivity({
    businessId,
    userId: req.user?.id,
    action: 'invoice_update',
    entityId: result.id,
    entityType: 'invoice',
  });

  res.json(result);
};

export const deleteInvoice = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { id } = req.params;

  await runSerializableTransaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id, businessId },
      include: { _count: { select: { payments: true } } },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice._count.payments > 0) {
      throw new AppError(
        'Invoice has recorded payments and cannot be deleted',
        409,
        'INVOICE_HAS_PAYMENTS'
      );
    }

    const activeReminder = await tx.reminder.findFirst({
      where: {
        businessId,
        entityId: id,
        entityType: 'invoice',
        status: { in: [...ACTIVE_REMINDER_STATUSES] },
      },
    });
    if (activeReminder) {
      throw new AppError(
        'Invoice has active reminders and cannot be deleted',
        409,
        'INVOICE_HAS_ACTIVE_REMINDERS'
      );
    }

    await tx.invoice.delete({ where: { id } });

    await tx.activityLog.create({
      data: {
        businessId,
        userId: req.user?.id,
        action: 'invoice_delete',
        entityId: id,
        entityType: 'invoice',
      },
    });
  });

  res.status(204).send();
};
