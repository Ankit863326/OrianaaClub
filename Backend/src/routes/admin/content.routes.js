// Phase 5b: Validate and expose post, event, and enquiry administration endpoints.
import { Router } from 'express';
import * as controller from '../../controllers/admin/content.controller.js';
import { eventImageUpload, postImageUpload } from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import {
  adminEventsQuerySchema,
  adminPostsQuerySchema,
  contentIdParamsSchema,
  enquiriesQuerySchema,
  enquiryNoteSchema,
  enquiryStatusSchema,
  eventCreateSchema,
  eventPatchSchema,
  postCreateSchema,
  postPatchSchema,
} from '../../validators/content.schema.js';

function createContentRouter(type) {
  const router = Router();
  const isPost = type === 'post';
  const imageUpload = isPost ? postImageUpload : eventImageUpload;
  const createSchema = isPost ? postCreateSchema : eventCreateSchema;
  const patchSchema = isPost ? postPatchSchema : eventPatchSchema;
  const querySchema = isPost ? adminPostsQuerySchema : adminEventsQuerySchema;

  router.get('/', validate(querySchema, 'query'), controller.list(type));
  router.post('/', imageUpload, validate(createSchema), controller.create(type));
  router.patch('/:id', imageUpload, validate(contentIdParamsSchema, 'params'), validate(patchSchema), controller.update(type));
  router.delete('/:id', validate(contentIdParamsSchema, 'params'), controller.remove(type));
  return router;
}

const posts = createContentRouter('post');
const events = createContentRouter('event');
const enquiries = Router();
enquiries.get('/', validate(enquiriesQuerySchema, 'query'), controller.enquiries);
enquiries.get('/summary', controller.enquiryStatusSummary);
enquiries.patch('/:id/status', validate(contentIdParamsSchema, 'params'), validate(enquiryStatusSchema), controller.updateEnquiryStatus);
enquiries.post('/:id/notes', validate(contentIdParamsSchema, 'params'), validate(enquiryNoteSchema), controller.addEnquiryNote);

export default { posts, events, enquiries };
