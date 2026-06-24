import { Router } from 'express';
import {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} from '../controllers/client.controller';
import { requireBusinessOwner } from '../middlewares/tenant';

const router = Router();

router.get('/', getClients);
router.get('/:id', getClientById);
router.post('/', requireBusinessOwner, createClient);
router.put('/:id', requireBusinessOwner, updateClient);
router.delete('/:id', requireBusinessOwner, deleteClient);

export default router;
