// Phase 5b: Provide paginated audit, email, and monthly report endpoints.
import { Router } from 'express';
import * as controller from '../../controllers/admin/operations.controller.js';
import validate from '../../middleware/validate.js';
import {
  auditQuerySchema,
  emailLogsQuerySchema,
  reportExportSchema,
  reportQuerySchema,
} from '../../validators/content.schema.js';

const router = Router();
router.get('/audit-logs', validate(auditQuerySchema, 'query'), controller.auditLogs);
router.get('/email-logs', validate(emailLogsQuerySchema, 'query'), controller.emailLogs);
router.get('/reports', validate(reportQuerySchema, 'query'), controller.reports);
router.get('/reports/export', validate(reportExportSchema, 'query'), controller.exportReport);
export default router;
