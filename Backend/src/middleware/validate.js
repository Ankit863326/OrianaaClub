// Phase 1: Parse a request body or query string with a Zod schema.
import ApiError from '../utils/ApiError.js';

export default function validate(schema, source = 'body') {
  return (request, response, next) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      next(new ApiError(400, result.error.issues[0]?.message || 'Invalid request data.'));
      return;
    }

    request.validated = { ...request.validated, [source]: result.data };
    next();
  };
}
