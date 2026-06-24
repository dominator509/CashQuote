import { Router } from 'express';
import {
  getQuotes,
  getQuoteById,
  createQuote,
  updateQuote,
  deleteQuote,
  convertQuote,
} from '../controllers/quote.controller';
import { requireBusinessOwner } from '../middlewares/tenant';

const router = Router();

router.get('/', getQuotes);
router.get('/:id', getQuoteById);
router.post('/', createQuote);
router.put('/:id', updateQuote);
router.delete('/:id', requireBusinessOwner, deleteQuote);
router.post('/:id/convert', convertQuote);

export default router;
