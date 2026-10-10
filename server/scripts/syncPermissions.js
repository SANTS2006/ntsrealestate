// Brings the database's permission catalog and every organization's built-in
// roles up to date with src/constants/permissions.js — run after that file
// changes (and on deploy). It is ADDITIVE only: it creates missing
// permissions and grants a built-in role any permission its template now
// lists, but never revokes anything, so roles an organization administrator
// customized keep what they were given.
//
// Usage: node scripts/syncPermissions.js
import { PrismaClient } from '@prisma/client';
import { PERMISSIONS, DEFAULT_ROLE_TEMPLATES } from '../src/constants/permissions.js';

const prisma = new PrismaClient();

const existing = await prisma.permission.findMany({ select: { id: true, name: true } });
const byName = new Map(existing.map((p) => [p.name, p.id]));

const missing = PERMISSIONS.filter((p) => !byName.has(p.name));
if (missing.length > 0) {
  await prisma.permission.createMany({ data: missing.map((p) => ({ name: p.name, description: p.description })), skipDuplicates: true });
  for (const p of await prisma.permission.findMany({ where: { name: { in: missing.map((m) => m.name) } } })) byName.set(p.name, p.id);
}
console.log(`permissions: ${missing.length} added, ${PERMISSIONS.length} total`);

const roles = await prisma.role.findMany({
  where: { isSystem: true, name: { in: Object.keys(DEFAULT_ROLE_TEMPLATES) } },
  include: { rolePermissions: { select: { permissionId: true } } },
});

let granted = 0;
for (const role of roles) {
  const have = new Set(role.rolePermissions.map((rp) => rp.permissionId));
  const rows = DEFAULT_ROLE_TEMPLATES[role.name].permissions
    .map((name) => byName.get(name))
    .filter((id) => id && !have.has(id))
    .map((permissionId) => ({ roleId: role.id, permissionId }));
  if (rows.length > 0) {
    await prisma.rolePermission.createMany({ data: rows, skipDuplicates: true });
    granted += rows.length;
    console.log(`  ${role.name} (${role.organizationId.slice(0, 8)}): +${rows.length}`);
  }
}
console.log(`role grants added: ${granted}`);
await prisma.$disconnect();
