// Browser admin requests must include this header to help block cross-site writes.
export default function adminCsrf(request, response, next) {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
    && request.get('X-Admin-Request') !== '1') {
    response.status(403).json({
      status: 'error',
      success: false,
      data: null,
      message: 'Missing or invalid X-Admin-Request header.',
    });
    return;
  }

  next();
}
