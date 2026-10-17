import ApiError from '../utils/ApiError.js';

export default function membershipDraftOpen(request, response, next) {
  if (request.membershipDraft?.status !== 'draft') {
    next(new ApiError(409, 'This membership application has already been submitted.'));
    return;
  }
  next();
}
