import multer from 'multer';
import { MAX_UPLOAD_BYTES } from '../integrations/cloudinary/fileValidation.js';
import { AppError } from '../utils/AppError.js';

// Memory storage only - an uploaded file is never written to local disk
// (this API has no production filesystem storage; see docs/architecture).
// The size cap here is the largest per-category limit (video); the tighter
// per-category limit is enforced again in fileValidation.js once we know
// which category the sniffed content actually falls into (defense in depth
// per docs/security/cloudinary-security.md section 6).
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

export function singleFileUpload(fieldName) {
  const middleware = upload.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return next(AppError.badRequest('File exceeds the maximum allowed upload size.'));
      return next(AppError.badRequest('File upload failed.'));
    });
  };
}

// For small, single images (profile pictures): a tight size cap is applied while
// the upload is still streaming in, so an oversized file is never held in memory.
export function limitedFileUpload(fieldName, maxBytes) {
  const small = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1 } });
  const middleware = small.single(fieldName);
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      if (err.code === 'LIMIT_FILE_SIZE') return next(AppError.badRequest(`The image is too large. The limit is ${Math.round(maxBytes / 1048576)} MB.`));
      return next(AppError.badRequest('File upload failed.'));
    });
  };
}
