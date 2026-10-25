import ApiError from '../utils/ApiError.js';

export default function membershipDraftOpen(request, response, next) {
  if (!['draft', 'failed'].includes(request.membershipDraft?.status)) {
    next(new ApiError(409, 'This membership application has already been submitted.'));
    return;
  }
  next();
}
