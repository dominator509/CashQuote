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
import { requireBusinessOwner } from '../middlewares/tenant';

const router = Router();

router.get('/', getInvoices);
router.get('/:id', getInvoiceById);
router.post('/', createInvoice);
router.put('/:id', updateInvoice);
router.delete('/:id', requireBusinessOwner, deleteInvoice);
router.get('/:invoiceId/payments', getInvoicePayments);
router.post('/:invoiceId/payments', requireBusinessOwner, postInvoicePayment);
router.delete('/:invoiceId/payments/:paymentId', requireBusinessOwner, removeInvoicePayment);

export default router;
