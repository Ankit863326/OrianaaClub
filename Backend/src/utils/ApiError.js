// Phase 0: Represent expected API failures with an HTTP status code.
export default class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    if (code) this.code = code;
    Error.captureStackTrace?.(this, ApiError);
  }
}
