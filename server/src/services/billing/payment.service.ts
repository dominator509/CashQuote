import { prisma } from 'db';
import { AppError } from '../../middlewares/error';

export const listInvoicePayments = async (invoiceId: string, businessId: string) => {
  const invoice = await prisma.invoice.findFirst({
    where: { id: invoiceId, businessId },
  });

  if (!invoice) {
    throw new AppError('Invoice not found', 404);
  }

  return prisma.payment.findMany({
    where: { invoiceId, businessId },
    orderBy: { paidAt: 'desc' },
  });
};

export const createInvoicePayment = async (
  invoiceId: string,
  businessId: string,
  userId: string | undefined,
  input: { amount: number; method: string; paidAt?: string }
) => {
  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    if (invoice.status === 'void') {
      throw new AppError('Cannot record payments for a void invoice', 400);
    }

    const paidTotal = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paidTotal + input.amount > invoice.total) {
      throw new AppError('Payment would exceed invoice total', 400);
    }

    const payment = await tx.payment.create({
      data: {
        invoiceId,
        businessId,
        amount: input.amount,
        method: input.method,
        paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
      },
    });

    const nextPaidTotal = paidTotal + input.amount;
    const nextStatus = nextPaidTotal >= invoice.total ? 'paid' : 'unpaid';

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: nextStatus },
    });

    await tx.activityLog.create({
      data: {
        businessId,
        userId,
        action: 'payment_create',
        entityId: payment.id,
        entityType: 'payment',
        details: `Recorded payment ${payment.id} for invoice ${invoice.id}`,
      },
    });

    return payment;
  });
};

export const deleteInvoicePayment = async (
  invoiceId: string,
  paymentId: string,
  businessId: string,
  userId?: string
) => {
  await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findFirst({
      where: { id: invoiceId, businessId },
      include: { payments: true },
    });

    if (!invoice) {
      throw new AppError('Invoice not found', 404);
    }

    const targetPayment = invoice.payments.find((candidate) => candidate.id === paymentId);
    if (!targetPayment) {
      throw new AppError('Payment not found', 404);
    }

    await tx.payment.delete({
      where: { id: paymentId },
    });

    const remainingTotal = invoice.payments
      .filter((candidate) => candidate.id !== paymentId)
      .reduce((sum, candidate) => sum + candidate.amount, 0);

    await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: remainingTotal >= invoice.total ? 'paid' : 'unpaid' },
    });

    await tx.activityLog.create({
      data: {
        businessId,
        userId,
        action: 'payment_delete',
        entityId: paymentId,
        entityType: 'payment',
        details: `Deleted payment ${paymentId} from invoice ${invoice.id}`,
      },
    });

  });
};
