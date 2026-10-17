// Phase 3: Expose administrator-only points adjustments and member ledger lookups.
import { Router } from 'express';
import * as pointsController from '../../controllers/admin-points.controller.js';
import validate from '../../middleware/validate.js';
import {
  pointsBulkCreditSchema,
  pointsCreditSchema,
  pointsDebitSchema,
} from '../../validators/points.schema.js';

const router = Router();

router.post('/credit', validate(pointsCreditSchema), pointsController.credit);
router.post('/debit', validate(pointsDebitSchema), pointsController.debit);
router.post('/bulk-credit', validate(pointsBulkCreditSchema), pointsController.bulkCredit);
export default router;
