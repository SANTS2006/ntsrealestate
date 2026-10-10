// Uniform response envelope for every endpoint — see docs/api/api-guide.md.
export function sendSuccess(res, { data = null, message = 'Operation completed successfully', statusCode = 200, meta } = {}) {
  return res.status(statusCode).json({
    success: true,
    data,
    message,
    ...(meta ? { meta } : {}),
  });
}

export function sendError(res, { code = 'INTERNAL_ERROR', message = 'An unexpected error occurred.', statusCode = 500, details } = {}) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
    ...(res.req?.id ? { requestId: res.req.id } : {}),
  });
}
