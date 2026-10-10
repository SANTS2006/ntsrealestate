// Validates a platform-admin-supplied URL namespace (e.g. "acme-realty" for
// /acme-realty/login). Deliberately NOT auto-derived from the organization
// name — the platform admin picks it explicitly per the product spec, but
// it still has to be a safe, unambiguous URL path segment.
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Reserved so a tenant slug can never shadow a real top-level route (the
// platform-admin console, the API prefix, static assets, etc.).
const RESERVED_SLUGS = new Set([
  'api', 'platform-admin', 'login', 'register', 'logout', 'home', 'dashboard',
  'assets', 'favicon.ico', 'static', 'public',
]);

export function normalizeSlug(rawSlug) {
  return String(rawSlug ?? '').trim().toLowerCase();
}

export function assertValidSlug(rawSlug) {
  const slug = normalizeSlug(rawSlug);
  if (slug.length < 2 || slug.length > 50) {
    return 'URL name must be between 2 and 50 characters.';
  }
  if (!SLUG_PATTERN.test(slug)) {
    return 'URL name can only contain lowercase letters, numbers, and single hyphens between them.';
  }
  if (RESERVED_SLUGS.has(slug)) {
    return 'That URL name is reserved. Please choose another.';
  }
  return null;
}
