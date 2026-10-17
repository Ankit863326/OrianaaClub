// Phase 1: Allow a request only when its authenticated user has an allowed role.
import ApiError from '../utils/ApiError.js';

export default function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      next(new ApiError(403, 'You do not have permission to access this resource.'));
      return;
    }

    next();
  };
}
