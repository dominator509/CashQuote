import { Router } from 'express';
import { getInsights } from '../controllers/radar.controller';

const router = Router();

router.get('/insights', getInsights);

export default router;
