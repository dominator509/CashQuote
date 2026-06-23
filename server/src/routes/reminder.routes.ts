import { Router } from 'express';
import {
  getReminders,
  postReminder,
  postResolveReminder,
  postSendReminder,
} from '../controllers/reminder.controller';

const router = Router();

router.get('/', getReminders);
router.post('/', postReminder);
router.post('/:id/send', postSendReminder);
router.post('/:id/resolve', postResolveReminder);

export default router;
