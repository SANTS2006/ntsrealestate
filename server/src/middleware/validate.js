// Generic Zod validation middleware — validates body/query/params together
// against a single schema shaped { body, query, params }, and replaces
// req.body/query/params with the *parsed* (coerced, trimmed, defaulted)
// output so downstream code only ever sees sanitized values. Throws
// ZodError on failure, caught by the centralized error handler.
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.parse({ body: req.body, query: req.query, params: req.params });
    if (parsed.body !== undefined) req.body = parsed.body;
    if (parsed.query !== undefined) req.query = parsed.query;
    if (parsed.params !== undefined) req.params = parsed.params;
    next();
  };
}
