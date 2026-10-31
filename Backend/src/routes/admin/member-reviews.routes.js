import { Router } from 'express';
import * as controller from '../../controllers/admin/member-reviews.controller.js';
import validate from '../../middleware/validate.js';
import { contentIdParamsSchema } from '../../validators/content.schema.js';
import { adminMemberReviewsQuerySchema } from '../../validators/member-review.schema.js';

const router = Router();
router.get('/', validate(adminMemberReviewsQuerySchema, 'query'), controller.list);
router.delete('/:id', validate(contentIdParamsSchema, 'params'), controller.remove);

export default router;
