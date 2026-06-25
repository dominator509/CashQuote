import { Router } from 'express';
import { getActivityLogs } from '../controllers/activity.controller';
import { requireBusinessOwner } from '../middlewares/tenant';

const router = Router();

router.get('/', requireBusinessOwner, getActivityLogs);

export default router;
