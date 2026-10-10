// Generates the initial admin password for a platform-admin-created
// organization, per the exact spec requested: the organization name's
// initials, "@", then the year it was added — e.g. "Surprise Real Estate"
// added in 2026 becomes "SRE@2026".
//
// SECURITY NOTE: this is a short, predictable, enumerable credential — it
// does not meet this app's own password policy (assertPasswordPolicy:
// 12+ chars, upper+lower+number) and is deliberately never run through it.
// It exists only as a one-time bootstrap value delivered privately by
// email to the organization's own administrator, who is expected to
// change it immediately. Treat this as a known, accepted weakness of the
// onboarding flow, not a general password standard.
export function generateDefaultAdminPassword(organizationName, year = new Date().getFullYear()) {
  const initials = String(organizationName)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/[^a-zA-Z]/g, '').charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();

  return `${initials}@${year}`;
}
