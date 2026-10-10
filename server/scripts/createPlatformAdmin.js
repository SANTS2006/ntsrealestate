// One-time bootstrap for the very first platform admin — there is no
// self-registration for this role by design (see
// src/services/platformAdmin.service.js), so someone with direct database/
// deploy access has to create the first one this way. Every platform admin
// after this can be created the same way, though in practice the first one
// would just do it from... nowhere yet, since there's no in-app UI for
// platform admins to create other platform admins either (out of scope for
// now — see the conversation this shipped in).
//
// Usage: node scripts/createPlatformAdmin.js "First" "Last" "email@example.com" "StrongPassword123"
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const [firstName, lastName, email, password] = process.argv.slice(2);

if (!firstName || !lastName || !email || !password) {
  console.error('Usage: node scripts/createPlatformAdmin.js <firstName> <lastName> <email> <password>');
  process.exit(1);
}
if (password.length < 12) {
  console.error('Password must be at least 12 characters.');
  process.exit(1);
}

const prisma = new PrismaClient();

const passwordHash = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

const admin = await prisma.platformAdmin.create({
  data: { firstName, lastName, email: email.toLowerCase(), passwordHash },
});

console.log(`Platform admin created: ${admin.email} (id: ${admin.id})`);
await prisma.$disconnect();
