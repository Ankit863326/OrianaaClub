import * as reviewService from '../../services/member-review.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  const data = await reviewService.listAdmin(request.validated.query);
  response.json({ success: true, data, message: 'Member reviews loaded.' });
});

export const remove = asyncHandler(async (request, response) => {
  const review = await reviewService.deleteAdmin(request.validated.params.id);
  await recordRequestAction(request, {
    action: 'member_review.delete',
    entityType: 'member_review',
    entityId: review._id,
    summary: `Deleted the member review by ${review.memberName}.`,
  });
  response.json({ success: true, data: null, message: 'Member review deleted.' });
});
