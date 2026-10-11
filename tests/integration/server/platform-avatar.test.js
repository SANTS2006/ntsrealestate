import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { prisma } from '../../../server/src/config/database.js';
import { setAvatar, removeAvatar, getAvatar } from '../../../server/src/services/platformAdminAvatar.service.js';

// Profile pictures for platform admins, against the real database, using a
// throwaway admin that is removed afterwards.

let admin;
let png;

beforeAll(async () => {
  png = await readFile(new URL('../../../client/public/favicon.png', import.meta.url));
  admin = await prisma.platformAdmin.create({
    data: { firstName: 'Avatar', lastName: 'Test', email: `avatar-${randomBytes(4).toString('hex')}@example.test`, passwordHash: 'x' },
  });
}, 60_000);

afterAll(async () => { if (admin) await prisma.platformAdmin.delete({ where: { id: admin.id } }).catch(() => {}); }, 60_000);

describe('platform admin profile picture', () => {
  it('stores a real image, serves it back identical, and marks the admin as having one', async () => {
    const res = await setAvatar(admin, { buffer: png, originalname: 'me.png', mimetype: 'image/png' }, {});
    expect(res.avatarUpdatedAt).toBeInstanceOf(Date);
    const got = await getAvatar(admin.id);
    expect(got.mimeType).toBe('image/png');
    expect(Buffer.compare(got.data, png)).toBe(0);
    expect((await prisma.platformAdmin.findUnique({ where: { id: admin.id } })).avatarUpdatedAt).not.toBeNull();
  }, 60_000);

  it('replaces the picture on a second upload', async () => {
    await setAvatar(admin, { buffer: png }, {});
    expect(await prisma.platformAdminAvatar.count({ where: { platformAdminId: admin.id } })).toBe(1);
  }, 60_000);

  it('rejects files that are not JPEG, PNG or WebP, whatever they are called', async () => {
    await expect(setAvatar(admin, { buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), originalname: 'x.png', mimetype: 'image/png' }, {})).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(setAvatar(admin, { buffer: Buffer.from('GIF89a' + 'x'.repeat(50)), originalname: 'x.png' }, {})).rejects.toThrow(/JPEG, PNG or WebP/);
    await expect(setAvatar(admin, { buffer: Buffer.alloc(0) }, {})).rejects.toThrow(/Choose an image/);
  }, 60_000);

  it('rejects an image over 2 MB', async () => {
    await expect(setAvatar(admin, { buffer: Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024)]) }, {})).rejects.toThrow(/too large/);
  }, 60_000);

  it('removes the picture', async () => {
    await removeAvatar(admin, {});
    await expect(getAvatar(admin.id)).rejects.toThrow(/No profile picture/);
    expect((await prisma.platformAdmin.findUnique({ where: { id: admin.id } })).avatarUpdatedAt).toBeNull();
  }, 60_000);
});
