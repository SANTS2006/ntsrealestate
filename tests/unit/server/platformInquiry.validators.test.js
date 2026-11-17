import { describe, it, expect } from 'vitest';
import { createPlatformInquirySchema, updatePlatformInquirySchema } from '../../../server/src/validators/platformInquiry.validators.js';

const parse = (body) => createPlatformInquirySchema.safeParse({ body });

describe('website inquiry validation', () => {
  it('accepts a contact message', () => {
    expect(parse({ kind: 'contact', name: 'Ada', email: 'ada@example.com', message: 'How much does it cost?' }).success).toBe(true);
  });

  it('requires a real message for contact, but not for a demo', () => {
    expect(parse({ kind: 'contact', name: 'Ada', email: 'ada@example.com', message: 'hi' }).success).toBe(false);
    expect(parse({ kind: 'demo', name: 'Ada', email: 'ada@example.com', company: 'Acme', phone: '+23231000000' }).success).toBe(true);
  });

  it('requires company and phone for a demo request', () => {
    const r = parse({ kind: 'demo', name: 'Ada', email: 'ada@example.com' });
    expect(r.success).toBe(false);
    expect(r.error.issues.map((i) => i.path[1]).sort()).toEqual(['company', 'phone']);
  });

  it('rejects bad emails, unknown kinds and unrecognised fields (mass assignment)', () => {
    expect(parse({ kind: 'contact', name: 'Ada', email: 'nope', message: 'long enough message' }).success).toBe(false);
    expect(parse({ kind: 'sales', name: 'Ada', email: 'ada@example.com', message: 'long enough message' }).success).toBe(false);
    expect(parse({ kind: 'contact', name: 'Ada', email: 'ada@example.com', message: 'long enough message', status: 'replied' }).success).toBe(false);
  });

  it('caps oversized input', () => {
    expect(parse({ kind: 'contact', name: 'A'.repeat(121), email: 'ada@example.com', message: 'long enough message' }).success).toBe(false);
    expect(parse({ kind: 'contact', name: 'Ada', email: 'ada@example.com', message: 'x'.repeat(3001) }).success).toBe(false);
  });
});

describe('inquiry status update validation', () => {
  const id = '3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b';
  it('accepts only known statuses', () => {
    expect(updatePlatformInquirySchema.safeParse({ params: { id }, body: { status: 'replied' } }).success).toBe(true);
    expect(updatePlatformInquirySchema.safeParse({ params: { id }, body: { status: 'deleted' } }).success).toBe(false);
    expect(updatePlatformInquirySchema.safeParse({ params: { id: 'not-a-uuid' }, body: { status: 'read' } }).success).toBe(false);
  });
});
