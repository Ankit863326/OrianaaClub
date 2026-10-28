// Accept JPG, PNG, or WebP images up to 10 MB and verify their actual file signature.
import multer from 'multer';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { verificationDocumentDirectory } from '../utils/verificationDocumentStorage.js';
import { identityDocumentDirectory, identityDocumentPath } from '../utils/identityDocumentStorage.js';
import { publicMediaDirectory } from '../utils/uploadDirectories.js';
import { encryptDocumentFile } from '../utils/identityDocumentCrypto.js';
import { identityVerificationSchema } from '../validators/identity-verification.schema.js';
import ApiError from '../utils/ApiError.js';

const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageSize = 10 * 1024 * 1024;
const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageSize, files: 1 },
  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, 'Only JPG, PNG, and WebP images are allowed.'));
      return;
    }
    callback(null, true);
  },
});

function hasValidImageSignature(file) {
  const bytes = file.buffer;
  if (file.mimetype === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.mimetype === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return file.mimetype === 'image/webp'
    && bytes.length >= 12
    && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.toString('ascii', 8, 12) === 'WEBP';
}

function photoUpload(fieldName) {
  return (request, response, next) => {
    parser.single(fieldName)(request, response, (error) => {
      if (error instanceof multer.MulterError) {
        next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be 10 MB or smaller.'
          : 'Only one image can be uploaded at a time.'));
        return;
      }
      if (error) {
        next(error);
        return;
      }
      if (request.file && !hasValidImageSignature(request.file)) {
        next(new ApiError(400, 'The uploaded file is not a valid JPG, PNG, or WebP image.'));
        return;
      }
      next();
    });
  };
}

export const profilePhotoUpload = photoUpload('photo');
export const familyPhotoUpload = photoUpload('photo');

const contentParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageSize, files: 1 },
  fileFilter(request, file, callback) {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, 'Only JPG, PNG, and WebP images are allowed.'));
      return;
    }
    callback(null, true);
  },
});

function contentImageUpload(fieldName) {
  return (request, response, next) => {
    contentParser.single(fieldName)(request, response, async (error) => {
      if (error instanceof multer.MulterError) {
        next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE'
          ? 'Image must be 10 MB or smaller.'
          : 'Only one image can be uploaded at a time.'));
        return;
      }
      if (error) {
        next(error);
        return;
      }
      if (!request.file) return next();
      if (!hasValidImageSignature(request.file)) {
        next(new ApiError(400, 'The uploaded file is not a valid JPG, PNG, or WebP image.'));
        return;
      }
      try {
        await mkdir(publicMediaDirectory, { recursive: true, mode: 0o750 });
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[request.file.mimetype];
        const filename = `${randomUUID()}.${extension}`;
        await writeFile(join(publicMediaDirectory, filename), request.file.buffer, { flag: 'wx', mode: 0o640 });
        request.file.publicUrl = `/media/${filename}`;
        next();
      } catch (writeError) {
        next(writeError);
      }
    });
  };
}

export const postImageUpload = contentImageUpload('coverImage');
export const eventImageUpload = contentImageUpload('image');
const verificationMimeExtensions = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);
const verificationParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxImageSize, files: 1 },
  fileFilter(request, file, callback) {
    if (!verificationMimeExtensions.has(file.mimetype)) {
      callback(new ApiError(400, 'Only JPG, JPEG, PNG, WebP, and PDF verification documents are allowed.'));
      return;
    }
    callback(null, true);
  },
});

function hasValidVerificationSignature(file) {
  if (file.mimetype === 'application/pdf') {
    return file.buffer.length >= 5 && file.buffer.toString('ascii', 0, 5) === '%PDF-';
  }
  return hasValidImageSignature(file);
}

function createVerificationDocumentUpload(required, mimeExtensions = verificationMimeExtensions) {
  return (request, response, next) => verificationParser.single('document')(request, response, async (error) => {
    if (error instanceof multer.MulterError) {
      next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE'
        ? 'Verification document must be 10 MB or smaller.'
        : 'Only one verification document can be uploaded at a time.'));
      return;
    }
    if (error) {
      next(error);
      return;
    }
    const { file } = request;
    if (!file && !required) {
      next();
      return;
    }
    if (!file || !mimeExtensions.has(file.mimetype) || !hasValidVerificationSignature(file)) {
      next(new ApiError(400, 'The uploaded verification document is invalid.'));
      return;
    }
    try {
      await mkdir(verificationDocumentDirectory, { recursive: true, mode: 0o700 });
      const extension = verificationMimeExtensions.get(file.mimetype);
      const storageKey = `${randomUUID()}.${extension}`;
      await writeFile(join(verificationDocumentDirectory, storageKey), file.buffer, { flag: 'wx', mode: 0o600 });
      file.storageKey = storageKey;
      file.documentId = randomUUID();
      file.publicName = file.originalname.replace(/[\\/]/g, '_').slice(0, 180);
      next();
    } catch (writeError) {
      next(writeError);
    }
  });
}

export const verificationDocumentUpload = createVerificationDocumentUpload(true);
export const optionalFamilyIdProofUpload = createVerificationDocumentUpload(false, new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['application/pdf', 'pdf'],
]));

const identityMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const familyVerificationMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const familyVerificationParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
  fileFilter(request, file, callback) {
    if (!familyVerificationMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, 'Family documents must be JPG, PNG, or PDF.'));
      return;
    }
    callback(null, true);
  },
});

function hasValidFamilyVerificationSignature(file) {
  if (file.mimetype === 'application/pdf') {
    return file.buffer.length >= 5 && file.buffer.toString('ascii', 0, 5) === '%PDF-';
  }
  return hasValidImageSignature(file);
}

export const familyVerificationDocumentUpload = (request, response, next) => {
  familyVerificationParser.fields([
    { name: 'document', maxCount: 1 },
    { name: 'extraDocument', maxCount: 1 },
  ])(request, response, (error) => {
    if (error instanceof multer.MulterError) {
      next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE'
        ? 'Each family verification document must be 5 MB or smaller.'
        : 'Upload at most one primary document and one extra document.'));
      return;
    }
    if (error) return next(error);

    const files = request.files || {};
    const document = files.document?.[0];
    const extraDocument = files.extraDocument?.[0];
    if (!document || !hasValidFamilyVerificationSignature(document)
      || (extraDocument && !hasValidFamilyVerificationSignature(extraDocument))) {
      next(new ApiError(400, 'Upload a valid JPG, PNG, or PDF verification document.'));
      return;
    }
    request.verificationUploads = { document, extraDocument };
    next();
  });
};

const identityParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
  fileFilter(request, file, callback) {
    if (!identityMimeTypes.has(file.mimetype)) {
      callback(new ApiError(400, 'Identity files must be JPG, PNG, or PDF.'));
      return;
    }
    callback(null, true);
  },
});

function hasValidIdentitySignature(file) {
  if (file.mimetype === 'application/pdf') {
    return file.buffer.length >= 5 && file.buffer.toString('ascii', 0, 5) === '%PDF-';
  }
  return hasValidImageSignature(file);
}

async function sanitizeIdentityFile(file) {
  if (file.mimetype === 'image/jpeg') {
    return sharp(file.buffer, { failOn: 'error' }).rotate().jpeg({ quality: 90 }).toBuffer();
  }
  if (file.mimetype === 'image/png') {
    return sharp(file.buffer, { failOn: 'error' }).rotate().png().toBuffer();
  }
  const pdf = await PDFDocument.load(file.buffer, { updateMetadata: false });
  pdf.setTitle('');
  pdf.setAuthor('');
  pdf.setSubject('');
  pdf.setKeywords([]);
  pdf.setCreator('');
  pdf.setProducer('');
  pdf.setCreationDate(new Date(0));
  pdf.setModificationDate(new Date(0));
  return Buffer.from(await pdf.save());
}

export const identityDocumentUpload = (request, response, next) => {
  identityParser.fields([
    { name: 'panFront', maxCount: 1 },
    { name: 'panBack', maxCount: 1 },
    { name: 'secondFront', maxCount: 1 },
    { name: 'secondBack', maxCount: 1 },
  ])(request, response, async (error) => {
    if (error instanceof multer.MulterError) {
      next(new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400, error.code === 'LIMIT_FILE_SIZE'
        ? 'Each identity file must be 5 MB or smaller.'
        : 'Upload exactly one PAN front, one ID front, and one ID back file.'));
      return;
    }
    if (error) return next(error);

    const files = request.files || {};
    const entries = [
      ['panFront', 'pan_front'],
      ['panBack', 'pan_back'],
      ['secondFront', 'second_front'],
      ['secondBack', 'second_back'],
    ];
    const requiredEntries = entries.filter(([field]) => field !== 'panBack');
    if (requiredEntries.some(([field]) => !files[field]?.[0])) {
      next(new ApiError(400, 'Upload the PAN front and both sides of the selected second ID.'));
      return;
    }
    const body = identityVerificationSchema.safeParse(request.body);
    if (!body.success) {
      next(new ApiError(400, body.error.issues[0]?.message || 'Identity details are invalid.'));
      return;
    }
    request.validated = { ...(request.validated || {}), body: body.data };
    try {
      const stored = [];
      request.identityDocuments = stored;
      await mkdir(identityDocumentDirectory, { recursive: true, mode: 0o700 });
      for (const [field, kind] of entries) {
        if (!files[field]?.[0]) continue;
        const file = files[field][0];
        if (!hasValidIdentitySignature(file)) {
          throw new ApiError(400, 'An identity file is not a valid JPG, PNG, or PDF.');
        }
        let cleaned;
        try {
          cleaned = await sanitizeIdentityFile(file);
        } catch {
          throw new ApiError(400, 'An identity file could not be safely read. Upload a valid JPG, PNG, or PDF.');
        }
        const storageKey = `${randomUUID()}.enc`;
        const storagePath = identityDocumentPath(storageKey);
        await writeFile(storagePath, encryptDocumentFile(cleaned), { flag: 'wx', mode: 0o600 });
        stored.push({
          field,
          id: randomUUID(),
          kind,
          storageKey,
          mimeType: file.mimetype,
        });
      }
      request.identityDocuments = stored;
      next();
    } catch (storageError) {
      await Promise.all((request.identityDocuments || []).map(async ({ storageKey }) => {
        try {
          await unlink(identityDocumentPath(storageKey));
        } catch (cleanupError) {
          if (cleanupError.code !== 'ENOENT') console.error('[identity-documents] Failed to remove an incomplete upload.');
        }
      }));
      next(storageError);
    }
  });
};
