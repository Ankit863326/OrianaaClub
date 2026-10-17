// Phase 0: Forward rejected async route-handler promises to Express error handling.
export default function asyncHandler(handler) {
  return function wrappedHandler(request, response, next) {
    return Promise.resolve(handler(request, response, next)).catch(next);
  };
}
