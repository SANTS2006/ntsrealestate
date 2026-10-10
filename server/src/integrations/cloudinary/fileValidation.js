import { fileTypeFromBuffer } from 'file-type';
import { AppError } from '../../utils/AppError.js';

// Never trust the client-declared MIME type or the filename extension -
// both are attacker-controlled. Every upload is sniffed from its actual
// magic bytes (file-type) and cross-checked against what the client
// claimed; a mismatch is rejected outright. See
// docs/security/cloudinary-security.md section 6 for the size/type table
// this implements.
const CATEGORIES = {
  image: {
    resourceType: 'image',
    maxBytes: 10 * 1024 * 1024,
    mimeTypes: new Set(['image/jpeg', 'image/png', 'image/webp']),
    extensions: new Set(['jpg', 'jpeg', 'png', 'webp']),
  },
  document: {
    resourceType: 'raw',
    maxBytes: 20 * 1024 * 1024,
    mimeTypes: new Set(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    extensions: new Set(['pdf', 'docx']),
  },
  video: {
    resourceType: 'video',
    maxBytes: 100 * 1024 * 1024,
    mimeTypes: new Set(['video/mp4', 'video/quicktime']),
    extensions: new Set(['mp4', 'mov']),
  },
};

export const MAX_UPLOAD_BYTES = Math.max(...Object.values(CATEGORIES).map((c) => c.maxBytes));

function safeExtension(originalFilename) {
  const match = /\.([a-zA-Z0-9]+)$/.exec(originalFilename ?? '');
  return match ? match[1].toLowerCase() : '';
}

const CONTROL_CHAR_PATTERN = new RegExp(`[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`, 'g');

// Strips path separators and control characters so a filename can never be
// used for path traversal or to smuggle a different extension than what was
// actually validated (e.g. "invoice.pdf .exe").
function sanitizeFilename(originalFilename) {
  const base = (originalFilename ?? 'file').split(/[/\\]/).pop();
  const noControlChars = base.replace(CONTROL_CHAR_PATTERN, '');
  return noControlChars.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150) || 'file';
}

// Returns { category, resourceType, mimeType, safeFilename } or throws AppError.
export async function validateUploadedFile(buffer, originalFilename, declaredMimeType) {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest('The uploaded file is empty.');
  }

  const sniffed = await fileTypeFromBuffer(buffer);
  if (!sniffed) {
    throw AppError.badRequest('The uploaded file type could not be verified and is not allowed.');
  }

  const declaredExt = safeExtension(originalFilename);
  const category = Object.entries(CATEGORIES).find(
    ([, def]) => def.mimeTypes.has(sniffed.mime) && def.extensions.has(sniffed.ext)
  )?.[0];

  if (!category) {
    throw AppError.badRequest(`File type "${sniffed.mime}" is not allowed.`);
  }

  const def = CATEGORIES[category];
  // The actual bytes, the declared Content-Type, and the filename's own
  // extension must all agree - any mismatch is treated as a spoofing
  // attempt (e.g. a renamed executable, or a PDF with a mismatched
  // declared type).
  if (declaredMimeType && declaredMimeType !== sniffed.mime) {
    throw AppError.badRequest('The declared file type does not match its actual content.');
  }
  if (declaredExt && !def.extensions.has(declaredExt)) {
    throw AppError.badRequest('The file extension does not match its actual content.');
  }
  if (buffer.length > def.maxBytes) {
    throw AppError.badRequest(`File exceeds the maximum allowed size of ${Math.round(def.maxBytes / (1024 * 1024))}MB for this file type.`);
  }

  return {
    category,
    resourceType: def.resourceType,
    mimeType: sniffed.mime,
    safeFilename: `${sanitizeFilename(originalFilename).replace(/\.[a-zA-Z0-9]+$/, '')}.${sniffed.ext}`,
  };
}
