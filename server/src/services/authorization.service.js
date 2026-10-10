import { findPermissionNamesForRoles } from '../repositories/role.repository.js';

// Re-derives the caller's effective permissions from current database state
// on every call — deliberately not cached across requests (a role edit or
// permission revocation must take effect on the very next request, not only
// after a session/token expires). See docs/security/authorization.md §3.
export async function getEffectivePermissions(organizationId, roleNames) {
  const names = await findPermissionNamesForRoles(organizationId, roleNames);
  return new Set(names);
}
