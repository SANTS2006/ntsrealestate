import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { registerVerifiedOrg, uniqueSuffix } from '../../integration/server/helpers/testUser.js';
import { deleteTestOrganization } from '../../integration/server/helpers/cleanup.js';

const suffix = uniqueSuffix();
let org;

// A minimal but genuinely valid 1x1 PNG — same fixture used in the Phase 6
// live verification and the fileValidation unit tests.
const REAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

beforeAll(async () => {
  org = await registerVerifiedOrg({
    orgName: `UploadOrg-${suffix}`, email: `upload-${suffix}@rems-test.local`, password: 'Correct-Falcon-Runway9',
  });
});

afterAll(async () => {
  await deleteTestOrganization(org?.organizationId);
});

function upload(fieldsAndFile) {
  const req = org.agent.post('/api/v1/documents').set('X-CSRF-Token', org.csrf).set('Origin', 'http://localhost:5173');
  req.field('entityType', 'organization').field('entityId', org.organizationId);
  return req.attach('file', fieldsAndFile.buffer, fieldsAndFile.filename);
}

describe('server-side file validation (never trusts extension or declared type)', () => {
  it('rejects a plain text file renamed to look like an image', async () => {
    const res = await upload({ buffer: Buffer.from('this is not an image, just text pretending to be one'), filename: 'photo.png' });
    expect(res.status).toBe(400);
  });

  it('rejects an executable-like payload disguised with an image extension', async () => {
    // MZ header — the actual magic bytes of a Windows PE executable.
    const fakeExe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(100, 0)]);
    const res = await upload({ buffer: fakeExe, filename: 'invoice.pdf' });
    expect(res.status).toBe(400);
  });

  it('rejects an empty file', async () => {
    const res = await upload({ buffer: Buffer.alloc(0), filename: 'empty.png' });
    expect(res.status).toBe(400);
  });

  it('accepts a genuinely valid PNG (control case — proves the rejections above are real validation, not blanket failure)', async () => {
    const res = await upload({ buffer: REAL_PNG, filename: 'real-photo.png' });
    expect(res.status).toBe(201);
    expect(res.body.data.mimeType).toBe('image/png');
  });
});

describe('path traversal in the uploaded filename is neutralized', () => {
  it('a filename containing "../" is sanitized rather than used verbatim', async () => {
    const res = await upload({ buffer: REAL_PNG, filename: '../../../../etc/passwd.png' });
    expect(res.status).toBe(201);
    expect(res.body.data.originalFilename).not.toContain('..');
    expect(res.body.data.originalFilename).not.toContain('/');
  });
});

describe('the uploaded asset is never publicly reachable', () => {
  it('the document metadata response never includes a raw/public Cloudinary URL — only an id to request access through', async () => {
    const res = await upload({ buffer: REAL_PNG, filename: 'private.png' });
    const serialized = JSON.stringify(res.body.data);
    expect(serialized).not.toMatch(/res\.cloudinary\.com/);
    expect(serialized).not.toMatch(/cloudinary_api_secret/i);
  });

  it('a valid access-url request returns a short-lived signed URL, not a permanent one', async () => {
    const uploadRes = await upload({ buffer: REAL_PNG, filename: 'signed.png' });
    const res = await org.agent.get(`/api/v1/documents/${uploadRes.body.data.id}/access-url`);
    expect(res.status).toBe(200);
    expect(res.body.data.url).toMatch(/signature=/);
    expect(res.body.data.expiresAt).toBeTruthy();
  });
});
