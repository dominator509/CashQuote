import { Router } from 'express';
import { generateLineItems } from '../controllers/ai.controller';

const router = Router();

router.post('/generate', generateLineItems);

export default router;
