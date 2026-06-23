import { Router } from 'express';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  deleteInvoice,
} from '../controllers/invoice.controller';
import {
  getInvoicePayments,
  postInvoicePayment,
  removeInvoicePayment,
} from '../controllers/payment.controller';

const router = Router();

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', deleteInvoice);
router.get('/:invoiceId/payments', getInvoicePayments);
router.post('/:invoiceId/payments', postInvoicePayment);
router.delete('/:invoiceId/payments/:paymentId', removeInvoicePayment);

export default router;
