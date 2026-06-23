import { Request, Response } from 'express';
import { createPaymentSchema } from 'shared';
import {
  createInvoicePayment,
  deleteInvoicePayment,
  listInvoicePayments,
} from '../services/billing/payment.service';

export const getInvoicePayments = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { invoiceId } = req.params;
  const payments = await listInvoicePayments(invoiceId, businessId);
  res.json(payments);
};

export const postInvoicePayment = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { invoiceId } = req.params;
  const data = createPaymentSchema.parse(req.body);
  const payment = await createInvoicePayment(invoiceId, businessId, req.user?.id, data);
  res.status(201).json(payment);
};

export const removeInvoicePayment = async (req: Request, res: Response) => {
  const businessId = req.business!.id;
  const { invoiceId, paymentId } = req.params;
  await deleteInvoicePayment(invoiceId, paymentId, businessId, req.user?.id);
  res.status(204).send();
};
