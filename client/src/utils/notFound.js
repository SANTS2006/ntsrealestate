// Works out whose "page not found" an unknown URL should get.
//
// First path segments the signed-in app itself owns (keep in step with the
// routes in App.jsx). Anything else in first position is read as a company's
// URL name (/:orgSlug/...).
const APP_SECTIONS = new Set([
  'home', 'dashboard', 'properties', 'chat', 'lands', 'deals', 'my-deals', 'network', 'agents', 'my-rentals',
  'tenants', 'message-manager', 'tenant-messages', 'owners', 'leases', 'my-lease', 'invoices', 'payments',
  'expenses', 'my-payments', 'maintenance', 'work-orders', 'vendors', 'inspections', 'users', 'roles',
  'settings', 'reports', 'notifications', 'audit-logs', 'referrals',
]);

// A company URL name is lowercase letters, digits and hyphens. Anything else
// (a file name, "%2e%2e", …) can't be a company, so it is never looked up.
const SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/i;

export function classifyPath(pathname) {
  const [first = ''] = pathname.split('/').filter(Boolean);
  const segment = first.toLowerCase();
  if (segment === 'platform-admin') return { area: 'platform' };
  if (APP_SECTIONS.has(segment)) return { area: 'app' };
  if (SLUG.test(first)) return { area: 'company', slug: segment };
  return { area: 'main' };
}
