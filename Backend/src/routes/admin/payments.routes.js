// Phase 5a: Define validated administrator payment review endpoints.
import { Router } from 'express';
import * as paymentsController from '../../controllers/admin/payments.controller.js';
import * as membershipPaymentsController from '../../controllers/admin/membership-purchase.controller.js';
import validate from '../../middleware/validate.js';
import {
  idParamsSchema,
  paymentsQuerySchema,
  refundBodySchema,
  rejectPaymentSchema,
} from '../../validators/admin.schema.js';
import {
  offlinePaymentSchema,
  paymentIdParamsSchema,
  paymentReceiptParamsSchema,
} from '../../validators/membership-purchase.schema.js';

const router = Router();

router.post('/', validate(offlinePaymentSchema), membershipPaymentsController.recordOfflinePayment);
router.patch('/:id/confirm', validate(paymentIdParamsSchema, 'params'), membershipPaymentsController.confirmOfflinePayment);
router.get('/:paymentId/receipt', validate(paymentReceiptParamsSchema, 'params'), paymentsController.downloadReceipt);
router.get('/export', validate(paymentsQuerySchema, 'query'), paymentsController.exportCsv);
router.get('/', validate(paymentsQuerySchema, 'query'), paymentsController.list);
router.get('/:id', validate(idParamsSchema, 'params'), paymentsController.details);
router.post('/:id/approve', validate(idParamsSchema, 'params'), paymentsController.approve);
router.post('/:id/reject', validate(idParamsSchema, 'params'), validate(rejectPaymentSchema), paymentsController.reject);
router.post('/:id/refund', validate(idParamsSchema, 'params'), validate(refundBodySchema), paymentsController.refund);

export default router;
