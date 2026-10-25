import TermsConsent from '../models/TermsConsent.js';
import ApiError from '../utils/ApiError.js';
import {
  currentTermsVersion,
  getCurrentTermsManifest,
} from '../config/terms.js';

export async function findCurrentTermsConsent(applicationId) {
  return TermsConsent.findOne({
    application_id: applicationId,
    terms_version: currentTermsVersion,
  }).sort({ accepted_at: -1 }).lean();
}

export async function getApplicationTermsConsent(applicationId) {
  const record = await findCurrentTermsConsent(applicationId);
  if (!record) return null;
  return {
    version: record.terms_version,
    language: record.language,
    acceptedAt: record.accepted_at,
  };
}

export async function requireCurrentTermsConsent(applicationId) {
  if (!await findCurrentTermsConsent(applicationId)) {
    throw new ApiError(409, 'Please accept the current membership agreement before proceeding.', 'TERMS_NOT_ACCEPTED');
  }
}

export async function createTermsConsent({
  applicationId,
  userId,
  version,
  language,
  readToEnd,
  ipAddress,
  userAgent,
}) {
  const manifest = await getCurrentTermsManifest();
  if (version !== manifest.version) {
    throw new ApiError(400, 'The membership agreement version is no longer current.');
  }
  const document = manifest.languages.find((item) => item.code === language);
  if (!document) {
    throw new ApiError(400, 'Choose a language available for the current membership agreement.');
  }
  if (readToEnd !== true) {
    throw new ApiError(400, 'Read the agreement to the end before accepting it.');
  }

  const query = {
    application_id: applicationId,
    terms_version: version,
    language,
  };
  const existing = await TermsConsent.findOne(query).lean();
  if (existing) return existing;

  const acceptedAt = new Date();
  try {
    return await TermsConsent.create({
      ...query,
      user_id: userId || null,
      document_sha256: document.sha256,
      accepted_at: acceptedAt,
      ip_address: ipAddress,
      user_agent: userAgent.slice(0, 1024),
      read_to_end: true,
      scroll_completed_at: acceptedAt,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const concurrentRecord = await TermsConsent.findOne(query).lean();
    if (!concurrentRecord) throw error;
    return concurrentRecord;
  }
}

export function serializeTermsConsent(record) {
  return {
    id: String(record._id),
    acceptedAt: record.accepted_at,
    version: record.terms_version,
    language: record.language,
  };
}
