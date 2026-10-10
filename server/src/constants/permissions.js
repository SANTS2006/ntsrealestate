// The full permission catalog (global — permissions themselves are not
// organization-scoped; `role_permissions` links them into a per-organization
// Role). Naming convention: `resource:action`.
//
// This is the Phase 4 bootstrap needed so a newly-registered organization's
// creator has a coherent Administrator role to log in with. Full
// enforcement (a `requirePermission` middleware checked on every resource
// route) lands in Phase 5 alongside the resource modules themselves.

const RESOURCES = [
  'organizations', 'users', 'roles', 'properties', 'buildings', 'units',
  'owners', 'tenants', 'leases', 'invoices', 'payments', 'expenses',
  'vendors', 'maintenance', 'work-orders', 'inspections', 'documents',
  'notifications', 'reports', 'audit-logs', 'audit-remarks', 'settings',
  'referrals', 'rentals', 'agents', 'lands', 'deals',
];

const STANDARD_ACTIONS = ['read', 'create', 'update', 'delete'];

const SPECIAL_PERMISSIONS = [
  'leases:terminate',
  'leases:renew',
  'payments:refund',
  'invoices:void',
  'expenses:approve',
  'documents:download',
  'users:invite',
  'users:change-role',
  // Not standard resource CRUD — a tenant composes (never reads back an
  // inbox of their own) and an agent/administrator reads (never creates,
  // there's no reply yet). See tenantMessage.service.js.
  'tenant-messages:create',
  'tenant-messages:read',
  // Setting a bonus amount / paying it out are deliberate financial actions,
  // not implied by referrals:update — see referral.service.js.
  'referrals:approve',
  'referrals:mark-paid',
];

export const PERMISSIONS = [
  ...RESOURCES.flatMap((resource) =>
    STANDARD_ACTIONS.map((action) => ({
      name: `${resource}:${action}`,
      description: `${action} ${resource.replace(/-/g, ' ')}`,
    }))
  ),
  ...SPECIAL_PERMISSIONS.map((name) => ({ name, description: name.replace(':', ' — ').replace(/-/g, ' ') })),
];

const ALL = PERMISSIONS.map((p) => p.name);
const readOnly = (resources) => resources.map((r) => `${r}:read`);
const readWrite = (resources) => resources.flatMap((r) => [`${r}:read`, `${r}:create`, `${r}:update`]);
const fullCrud = (resources) => resources.flatMap((r) => [`${r}:read`, `${r}:create`, `${r}:update`, `${r}:delete`]);

// Default role → permission-name mapping seeded for every new organization.
// Organization admins can edit/create additional roles later (Phase 5 UI);
// these are starting points, not immutable system constraints, except
// `administrator` which always keeps full access (see role.service.js).
export const DEFAULT_ROLE_TEMPLATES = {
  administrator: {
    description: 'Full access within the organization.',
    permissions: ALL,
  },
  accountant: {
    description: 'Manages invoicing, payments, expenses, and financial reporting.',
    permissions: [
      ...readWrite(['invoices', 'payments', 'expenses', 'documents']),
      ...readOnly(['properties', 'units', 'tenants', 'leases', 'owners', 'vendors', 'referrals', 'lands', 'deals']),
      'payments:refund', 'invoices:void', 'expenses:approve', 'documents:download',
      'referrals:approve', 'referrals:mark-paid',
      ...readWrite(['reports']),
    ],
  },
  maintenance_manager: {
    description: 'Manages maintenance requests, work orders, and vendors.',
    permissions: [
      ...readWrite(['maintenance', 'work-orders', 'vendors', 'inspections', 'documents']),
      ...readOnly(['properties', 'units', 'tenants']),
      'documents:download', 'tenant-messages:read',
    ],
  },
  // Read-only and scoped to properties they own (Property.ownerId) — see
  // resourceAccess.service.js's `getRestrictedScope` for the ownerId->
  // propertyIds resolution, consumed by owner.service.js/tenant.service.js/
  // lease.service.js/etc. to filter every list down to their own portfolio.
  // Deliberately has no `owners:*` beyond their own record (owner.service.js
  // self-scopes that regardless of permission) — they have no reason to
  // browse other owners.
  owner: {
    description: 'Manages their own properties, finances, maintenance and agents.',
    permissions: [
      // Add and edit their own properties, buildings and units.
      ...readWrite(['properties', 'buildings', 'units']),
      // Everyone renting from them, and the leases/documents around that.
      ...readOnly(['tenants', 'leases', 'referrals', 'owners', 'rentals', 'lands', 'deals']),
      // The full finance module for their portfolio.
      ...fullCrud(['invoices', 'payments', 'expenses']),
      ...readWrite(['reports']),
      // Maintenance, with delete.
      ...fullCrud(['maintenance', 'work-orders']),
      // Vendors are shared across the whole organization, so an owner can use
      // and add them but never edit or delete another owner's.
      'vendors:read', 'vendors:create',
      ...readWrite(['inspections', 'documents', 'notifications']),
      // Their agents: see, add, update, deactivate, delete.
      ...fullCrud(['agents']),
      'documents:download', 'expenses:approve', 'tenant-messages:read',
    ],
  },
  // The one assignment-scoped "manages specific properties" role (formerly
  // split with property_manager, which was removed as redundant — this
  // absorbed its full permission set). Scoped via PropertyAssignment, not
  // ownership — see ASSIGNMENT_SCOPED_ROLES in resourceAccess.service.js.
  agent: {
    description: 'Manages the properties and tenants of the owners they are linked to.',
    permissions: [
      ...readWrite(['properties', 'buildings', 'units', 'tenants', 'leases', 'work-orders', 'inspections', 'vendors', 'documents', 'notifications', 'reports']),
      // Full finance and maintenance access for their owners' portfolios.
      ...fullCrud(['invoices', 'payments', 'expenses', 'maintenance']),
      ...readOnly(['owners', 'referrals', 'rentals', 'agents', 'lands']),
      'deals:read', 'deals:update',
      'leases:terminate', 'leases:renew', 'documents:download', 'tenant-messages:read', 'expenses:approve',
    ],
  },
  tenant: {
    description: "Access to their own lease, invoices, payments, documents, and maintenance requests.",
    permissions: [
      ...readOnly(['tenants', 'leases', 'invoices', 'payments', 'documents', 'referrals']),
      'maintenance:read', 'maintenance:create', 'documents:download', 'tenant-messages:create',
      // See and register rentals; see the owners/agents they are registered to.
      'rentals:read', 'rentals:create', 'owners:read', 'agents:read', 'deals:read', 'deals:create',
    ],
  },
  auditor: {
    description: 'Organization-wide read-only access.',
    // `documents:download` is a SPECIAL_PERMISSION, not covered by
    // readOnly(RESOURCES) — without it, GET /documents/:id/access-url 403s
    // (it's gated by `documents:download`, not `documents:read`), so an
    // auditor could see a document's metadata in a list but never actually
    // view/download it — including every avatar and property photo in the
    // app, since those render via a signed access-url fetch too.
    //
    // `audit-remarks:create` is the one deliberate write exception to
    // "read-only" — leaving a remark after a review is the auditor's actual
    // job, not a system mutation (see audit-remark.service.js). Nothing else
    // in this role writes anything.
    permissions: [...readOnly(RESOURCES), 'documents:download', 'audit-remarks:create'],
  },
};
