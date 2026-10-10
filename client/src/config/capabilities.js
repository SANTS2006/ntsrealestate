// Which controls a signed-in person gets to see.
//
// Each CAN_* below is a list of PERMISSIONS (resource:action, the same names
// the server enforces) — a control is shown if the person holds ANY of them.
// The permissions come from the server with the signed-in user (they are the
// union of what the user's roles grant, including anything an administrator
// customized), so a button appears exactly when its action would be allowed,
// and is simply absent otherwise. This is a UX layer only: the server's
// requirePermission/ownership checks remain the real boundary.
//
// A few capabilities are genuinely about the role rather than a permission
// (e.g. the organization-wide notification feed); those list role names and
// are checked against the person's roles instead.

let currentPermissions = new Set();

// Called by AuthProvider whenever the signed-in user changes.
export function setCurrentPermissions(permissions) {
  currentPermissions = new Set(permissions ?? []);
}

export function hasPermission(...permissions) {
  return permissions.some((p) => currentPermissions.has(p));
}

// `roles` is only used for entries that are role names (no ":" in them).
export function canAny(roles, allowed) {
  return allowed.some((entry) => (entry.includes(':') ? currentPermissions.has(entry) : roles.includes(entry)));
}

export const CAN_CREATE_PROPERTIES = ['properties:create'];
export const CAN_UPDATE_PROPERTIES = ['properties:update'];
export const CAN_DELETE_PROPERTIES = ['properties:delete'];

export const CAN_MANAGE_BUILDINGS = ['buildings:create'];
export const CAN_MANAGE_UNITS = ['units:create'];

export const CAN_MANAGE_TENANTS = ['tenants:create'];
export const CAN_MANAGE_OWNERS = ['owners:create'];
export const CAN_MANAGE_LEASES = ['leases:create'];

export const CAN_MANAGE_INVOICES = ['invoices:create'];
export const CAN_MANAGE_PAYMENTS = ['payments:create'];
export const CAN_MANAGE_EXPENSES = ['expenses:create'];
export const CAN_MANAGE_FINANCE = ['invoices:create', 'payments:create', 'expenses:create'];

export const CAN_MANAGE_MAINTENANCE = ['maintenance:update'];
export const CAN_MANAGE_WORK_ORDERS = ['work-orders:create'];
export const CAN_MANAGE_VENDORS = ['vendors:create'];
export const CAN_MANAGE_INSPECTIONS = ['inspections:create'];
export const CAN_UPDATE_INSPECTIONS = ['inspections:update'];
export const CAN_CREATE_MAINTENANCE = ['maintenance:create'];

export const CAN_MANAGE_USERS = ['users:update'];
export const CAN_INVITE_USERS = ['users:invite'];
export const CAN_DELETE_USERS = ['users:delete'];
export const CAN_VIEW_USERS = ['users:read'];
export const CAN_MANAGE_ROLES = ['roles:create'];

export const CAN_MANAGE_ORGANIZATION = ['organizations:update'];
export const CAN_VIEW_ORGANIZATION = ['organizations:read'];

export const CAN_VIEW_REPORTS = ['reports:read'];

export const CAN_UPLOAD_DOCUMENTS = ['documents:create'];
export const CAN_DELETE_DOCUMENTS = ['documents:delete'];

export const CAN_VIEW_AUDIT_LOGS = ['audit-logs:read'];
export const CAN_CREATE_AUDIT_REMARKS = ['audit-remarks:create'];

// The org-wide "every notification, for every user" feed is the one place
// the server checks the administrator ROLE itself, so this one is a role.
export const CAN_VIEW_ALL_NOTIFICATIONS = ['administrator'];

export const CAN_SEND_TENANT_MESSAGE = ['tenant-messages:create'];
export const CAN_VIEW_TENANT_MESSAGES = ['tenant-messages:read'];

export const CAN_MANAGE_REFERRALS = ['referrals:approve'];

// An owner manages their own agents; an administrator can link any agent to
// any owner.
export const CAN_MANAGE_AGENTS = ['agents:create'];
