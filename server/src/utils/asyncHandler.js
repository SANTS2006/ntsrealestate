// Express 4 does not catch rejected promises from async route/middleware
// handlers automatically. Wrap every async controller with this so a thrown
// AppError (or any rejection) reaches the centralized error handler instead
// of hanging the request or crashing the process.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
