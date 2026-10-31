// Phase 5b: Expose published-only stories and upcoming events to website visitors.
import { Router } from 'express';
import * as contentController from '../controllers/content.controller.js';
import * as memberReviewController from '../controllers/member-review.controller.js';
import validate from '../middleware/validate.js';
import { publicPostsQuerySchema, slugParamsSchema } from '../validators/content.schema.js';

const router = Router();
router.get('/stories/reviews', memberReviewController.publicReviews);
router.get('/posts', validate(publicPostsQuerySchema, 'query'), contentController.posts);
router.get('/posts/:slug', validate(slugParamsSchema, 'params'), contentController.post);
router.get('/events', validate(publicPostsQuerySchema, 'query'), contentController.events);
router.get('/events/:slug', validate(slugParamsSchema, 'params'), contentController.event);
export default router;
