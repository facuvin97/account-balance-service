import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { depositSchema, withdrawalSchema, balanceSchema, ledgerEntriesSchema } from './schemas';
import {
  depositController,
  withdrawalController,
  balanceController,
  ledgerEntriesController,
} from '../controllers/accountController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.post('/:accountId/deposits', validate(depositSchema), asyncHandler(depositController));
router.post('/:accountId/withdrawals', validate(withdrawalSchema), asyncHandler(withdrawalController));
router.get('/:accountId/balance', validate(balanceSchema), asyncHandler(balanceController));
router.get('/:accountId/ledger-entries', validate(ledgerEntriesSchema), asyncHandler(ledgerEntriesController));

export default router;
