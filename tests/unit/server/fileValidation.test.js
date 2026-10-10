import { describe, it, expect } from 'vitest';
import { validateUploadedFile } from '../../../server/src/integrations/cloudinary/fileValidation.js';

// A minimal but genuinely valid 1x1 PNG (same fixture used in the live
// Cloudinary verification pass for this phase).
const REAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

describe('validateUploadedFile', () => {
  it('accepts a genuine PNG with matching extension and MIME type', async () => {
    const result = await validateUploadedFile(REAL_PNG, 'photo.png', 'image/png');
    expect(result.category).toBe('image');
    expect(result.resourceType).toBe('image');
    expect(result.mimeType).toBe('image/png');
  });

  it('rejects content whose magic bytes cannot be identified at all', async () => {
    const notAFile = Buffer.from('this is just plain text, not any known file format');
    await expect(validateUploadedFile(notAFile, 'fake.png', 'image/png')).rejects.toThrow();
  });

  it('rejects a real file whose declared MIME type does not match its actual bytes', async () => {
    // Real PNG bytes, but claiming to be a PDF — the classic "renamed
    // executable" / content-type spoofing attack this check exists for.
    await expect(validateUploadedFile(REAL_PNG, 'document.pdf', 'application/pdf')).rejects.toThrow();
  });

  it('rejects a real file whose extension does not match its actual bytes', async () => {
    await expect(validateUploadedFile(REAL_PNG, 'invoice.exe', undefined)).rejects.toThrow();
  });

  it('rejects an empty buffer', async () => {
    await expect(validateUploadedFile(Buffer.alloc(0), 'empty.png', 'image/png')).rejects.toThrow();
  });

  it('sanitizes a filename with path traversal / unsafe characters', async () => {
    const result = await validateUploadedFile(REAL_PNG, '../../etc/passwd\x00.png', 'image/png');
    expect(result.safeFilename).not.toMatch(/[/\\]/);
    expect(result.safeFilename).not.toContain('..');
  });
});
