// Areas of the system a maintenance notice can be limited to. `key` matches the
// server's MAINTENANCE_PAGE_GROUPS.
export const MAINTENANCE_GROUPS = [
  { key: 'website', label: 'Public website', hint: 'The listings and lands website' },
  { key: 'home', label: 'Platform home page', hint: 'The page with the company logos' },
  { key: 'signin', label: 'Sign-in pages', hint: 'Login, register and password pages of every company' },
  { key: 'dashboard', label: 'Home & dashboard', hint: 'First pages after signing in' },
  { key: 'properties', label: 'Properties & lands', hint: 'Properties, buildings, units and lands' },
  { key: 'people', label: 'People', hint: 'Tenants, owners, agents and the network' },
  { key: 'deals', label: 'Leases & sales', hint: 'Leases, sales, rentals and My deals' },
  { key: 'finance', label: 'Finance', hint: 'Invoices, payments, expenses and reports' },
  { key: 'maintenance', label: 'Maintenance', hint: 'Requests, work orders, vendors and inspections' },
  { key: 'chat', label: 'Chat', hint: 'Messages and calls' },
  { key: 'admin', label: 'Users, settings & audit', hint: 'Users, roles, settings, notifications and audit logs' },
  { key: 'platform', label: 'Platform console', hint: 'The platform admin pages' },
];

const FIRST_SEGMENT = {
  home: 'dashboard', dashboard: 'dashboard',
  properties: 'properties', lands: 'properties',
  tenants: 'people', owners: 'people', agents: 'people', network: 'people', 'my-rentals': 'people',
  leases: 'deals', 'my-lease': 'deals', deals: 'deals', 'my-deals': 'deals',
  invoices: 'finance', payments: 'finance', expenses: 'finance', reports: 'finance', 'my-payments': 'finance',
  maintenance: 'maintenance', 'work-orders': 'maintenance', vendors: 'maintenance', inspections: 'maintenance',
  chat: 'chat',
  users: 'admin', roles: 'admin', settings: 'admin', notifications: 'admin', 'audit-logs': 'admin', referrals: 'admin', 'tenant-messages': 'admin', 'message-manager': 'admin',
  'platform-admin': 'platform',
};

// Which area a page belongs to: '/ui-co/login' -> 'signin', '/payments' -> 'finance'.
export function groupForPath(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0) return 'home';
  if (FIRST_SEGMENT[parts[0]]) return FIRST_SEGMENT[parts[0]];
  // anything else is a company's own address: /:company/login, /:company/rent …
  return 'signin';
}
