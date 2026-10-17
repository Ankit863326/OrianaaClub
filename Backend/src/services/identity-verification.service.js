import { readFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import ApiError from '../utils/ApiError.js';
import IdentityVerification from '../models/IdentityVerification.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import { decryptDocumentFile, encryptIdentityValue, hashIdentityValue } from '../utils/identityDocumentCrypto.js';
import { identityDocumentPath } from '../utils/identityDocumentStorage.js';
import { validateIdentityNumber } from '../utils/identityDocumentValidation.js';
import { activateMembership, finalizePayment } from './payment.service.js';

function publicDocument(document) {
  return {
    id: document.id,
    kind: document.kind,
    mimeType: document.mimeType,
    uploadedAt: document.uploadedAt,
  };
}

export function publicIdentityVerification(record) {
  if (!record) {
    return {
      status: 'not_submitted',
      panMask: '',
      idType: '',
      idMask: '',
      rejectionReason: '',
      documents: [],
    };
  }
  return {
    status: record.status,
    panMask: record.panMask,
    idType: record.idType,
    idMask: record.idMask,
    rejectionReason: record.status === 'rejected' ? record.rejectionReason : '',
    documents: (record.documents || []).map(publicDocument),
    verifiedAt: record.verifiedAt || null,
  };
}

async function discardDocuments(documents) {
  await Promise.all((documents || []).map(async ({ storageKey }) => {
    try {
      await unlink(identityDocumentPath(storageKey));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('[identity-documents] Failed to remove a private document.');
    }
  }));
}

export async function discardUncommittedIdentityDocuments(documents) {
  await discardDocuments(documents);
}

export async function getMemberIdentityVerification(userId) {
  const record = await IdentityVerification.findOne({ user: userId }).lean();
  return publicIdentityVerification(record);
}

export async function submitMemberIdentityVerification(userId, values, uploadedDocuments) {
  const pan = validateIdentityNumber('pan', values.panNumber);
  if (!pan) throw new ApiError(400, 'Enter a valid PAN number in the format ABCDE1234F.');
  const secondId = validateIdentityNumber(values.secondIdType, values.secondIdNumber);
  if (!secondId) {
    const help = {
      aadhaar: 'Enter a valid 12-digit Aadhaar number that passes checksum verification.',
      driving_licence: 'Enter a valid Indian Driving Licence number (state, RTO, year, and serial).',
      passport: 'Enter a valid Indian passport number (one letter followed by seven digits).',
    };
    throw new ApiError(400, help[values.secondIdType]);
  }
  const requiredKinds = ['pan_front', 'second_front', 'second_back'];
  if (!Array.isArray(uploadedDocuments)
    || uploadedDocuments.length < 3
    || uploadedDocuments.length > 4
    || requiredKinds.some((kind) => uploadedDocuments.filter((document) => document.kind === kind).length !== 1)) {
    throw new ApiError(400, 'Upload the PAN front and both sides of the selected second ID.');
  }
  const previous = await IdentityVerification.findOne({ user: userId });
  if (previous && previous.status !== 'rejected') {
    throw new ApiError(409, 'Your identity documents have already been submitted and are awaiting review or verified.');
  }
  const aadhaarHash = values.secondIdType === 'aadhaar' ? hashIdentityValue(secondId.value) : '';
  if (aadhaarHash && await IdentityVerification.findOne({
    user: { $ne: userId },
    idType: 'aadhaar',
    aadhaarHash,
  }).select('+aadhaarHash').lean()) {
    throw new ApiError(409, 'This identity number is already associated with an account.');
  }
  const documents = uploadedDocuments.map((document) => ({
    id: document.id || randomUUID(),
    kind: document.kind,
    storageKey: document.storageKey,
    mimeType: document.mimeType,
    uploadedAt: new Date(),
  }));
  const valuesToSave = {
    panCiphertext: encryptIdentityValue(pan.value),
    panMask: pan.mask,
    idType: values.secondIdType,
    idCiphertext: encryptIdentityValue(secondId.value),
    idMask: secondId.mask,
    aadhaarLast4: values.secondIdType === 'aadhaar' ? secondId.last4 : '',
    aadhaarHash,
    status: 'pending',
    rejectionReason: '',
    consentAt: new Date(),
    documents,
    verifiedBy: null,
    verifiedAt: null,
    rejectedBy: null,
    rejectedAt: null,
  };
  try {
    const record = previous
      ? await IdentityVerification.findOneAndUpdate(
        { _id: previous._id, status: 'rejected' },
        { $set: valuesToSave },
        { new: true, runValidators: true },
      )
      : await IdentityVerification.create({ user: userId, ...valuesToSave });
    if (!record) throw new ApiError(409, 'Your identity verification status changed. Refresh and try again.');
    if (previous) await discardDocuments(previous.documents);
    return publicIdentityVerification(record);
  } catch (error) {
    await discardDocuments(documents);
    if (error.code === 11000) throw new ApiError(409, 'This identity number is already associated with an account.');
    throw error;
  }
}

export async function getAdminIdentityVerification(userId) {
  const record = await IdentityVerification.findOne({ user: userId }).lean();
  return publicIdentityVerification(record);
}

export async function readAdminIdentityDocument(userId, documentId) {
  const record = await IdentityVerification.findOne({ user: userId });
  const document = record?.documents.find((item) => item.id === documentId);
  if (!document) throw new ApiError(404, 'Identity document was not found.');
  let stored;
  try {
    stored = await readFile(identityDocumentPath(document.storageKey));
  } catch (error) {
    if (error.code === 'ENOENT') throw new ApiError(404, 'Identity document was not found.');
    throw error;
  }
  return { document, buffer: decryptDocumentFile(stored) };
}

export async function reviewIdentityVerification(userId, adminId, { status, reason = '' }) {
  const values = status === 'verified'
    ? { status, verifiedBy: adminId, verifiedAt: new Date(), rejectedBy: null, rejectedAt: null, rejectionReason: '' }
    : { status, rejectedBy: adminId, rejectedAt: new Date(), verifiedBy: null, verifiedAt: null, rejectionReason: reason };
  let record = await IdentityVerification.findOneAndUpdate(
    { user: userId, status: 'pending' },
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!record && status === 'verified') {
    record = await IdentityVerification.findOne({ user: userId, status: 'verified' });
  }
  if (!record) throw new ApiError(409, 'Identity documents are not awaiting review.');
  if (status === 'verified') {
    const membership = await Membership.findOne({ user: userId, status: 'pending_verification' }).sort({ createdAt: -1 });
    if (membership) {
      const payment = await Payment.findOne({
        membership: membership._id,
        status: { $in: membership.planModel === 'Plan' ? ['paid'] : ['confirmed'] },
      }).sort({ createdAt: -1 });
      const plan = await membership.populate('plan');
      const eligibilityVerified = !plan?.plan?.requiresVerification || membership.eligibilityVerified;
      if (payment && eligibilityVerified) {
        if (membership.planModel === 'Plan') {
          await finalizePayment(payment._id);
        } else {
          await activateMembership(membership._id, payment._id);
        }
      }
    }
  }
  return publicIdentityVerification(record);
}

export async function deleteIdentityDocumentsForUser(userId) {
  const record = await IdentityVerification.findOneAndDelete({ user: userId });
  if (record) await discardDocuments(record.documents);
}
