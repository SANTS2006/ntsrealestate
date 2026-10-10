// Shape a User row (which carries passwordHash, mfaSecretEncrypted, etc.)
// down to what's safe to ever put in an API response. Every controller/
// service that returns user data goes through this — never `return user`
// or `res.json(user)` directly against a raw Prisma row.
export function serializeUser(user, roles, permissions) {
  return {
    id: user.id,
    organizationId: user.organizationId,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    phone: user.phone ?? null,
    status: user.status,
    emailVerified: user.emailVerified,
    mfaEnabled: user.mfaEnabled,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt,
    referralCode: user.referralCode ?? null,
    ...(roles !== undefined ? { roles } : {}),
    // What this person's roles let them do — the client uses it to show only
    // the controls they can actually use (the server still enforces every one).
    ...(permissions !== undefined ? { permissions: [...permissions].sort() } : {}),
  };
}
