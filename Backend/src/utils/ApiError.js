// Phase 0: Represent expected API failures with an HTTP status code.
export default class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    Error.captureStackTrace?.(this, ApiError);
  }
}
