import { z } from 'zod';

const uuid = z.string().uuid();
const b64 = (max) => z.string().min(1).max(max).regex(/^[A-Za-z0-9+/_=-]+$/, 'Invalid encoding.');
const ref = z.string().regex(/^[up]:[0-9a-f-]{36}$/i, 'Invalid participant.');

export const roomIdParamSchema = z.object({ params: z.object({ roomId: uuid }) });
export const attachmentIdParamSchema = z.object({ params: z.object({ attachmentId: uuid }) });

export const saveKeySchema = z.object({
  body: z.object({
    publicKey: z.string().min(20).max(2000),
    encryptedPrivateKey: b64(8000),
    keySalt: b64(100),
    keyIv: b64(100),
    kdfIterations: z.number().int().min(100000).max(2000000).default(250000),
    reset: z.boolean().optional(),
  }).strict(),
});

export const openDirectSchema = z.object({ body: z.object({ ref }).strict() });

export const distributeKeysSchema = z.object({
  params: z.object({ roomId: uuid }),
  body: z.object({
    keys: z.array(z.object({
      ref,
      wrappedKey: b64(2000),
      wrapIv: b64(100),
      wrapperPublicKey: z.string().min(20).max(2000),
    }).strict()).min(1).max(500),
  }).strict(),
});

export const listMessagesSchema = z.object({
  params: z.object({ roomId: uuid }),
  query: z.object({ before: z.string().datetime().optional(), limit: z.coerce.number().int().min(1).max(100).optional() }),
});

export const sendMessageSchema = z.object({
  params: z.object({ roomId: uuid }),
  body: z.object({
    ciphertext: b64(150_000),
    iv: b64(40),
    attachmentId: uuid.optional(),
  }).strict(),
});
