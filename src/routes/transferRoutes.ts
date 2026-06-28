import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { transferSchema } from './schemas';
import { transferController } from '../controllers/transferController';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

router.post('/', validate(transferSchema), asyncHandler(transferController));

export default router;
