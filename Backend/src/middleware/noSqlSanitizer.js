function sanitize(value) {
  if (Array.isArray(value)) return value.map(sanitize);
  if (!value || typeof value !== 'object' || value instanceof Date || Buffer.isBuffer(value)) return value;

  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !key.startsWith('$') && !key.includes('.'))
    .map(([key, nested]) => [key, sanitize(nested)]));
}

export default function noSqlSanitizer(request, response, next) {
  if (request.body && typeof request.body === 'object') request.body = sanitize(request.body);
  if (request.params && typeof request.params === 'object') request.params = sanitize(request.params);
  if (request.query && typeof request.query === 'object') {
    Object.defineProperty(request, 'query', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: sanitize(request.query),
    });
  }
  next();
}

export { sanitize as sanitizeMongoQuery };
