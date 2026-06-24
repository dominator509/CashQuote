import { Router } from 'express';
import {
  getReminders,
  postReminder,
  postResolveReminder,
  postSendReminder,
} from '../controllers/reminder.controller';
import { requireBusinessOwner } from '../middlewares/tenant';

const router = Router();

router.get('/', getReminders);
router.post('/', requireBusinessOwner, postReminder);
router.post('/:id/send', requireBusinessOwner, postSendReminder);
router.post('/:id/resolve', requireBusinessOwner, postResolveReminder);

export default router;
