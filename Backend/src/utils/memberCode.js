import { MEMBER_ID_FIXED_SEGMENT } from '../config/member-id.js';

const legacyMemberCodePattern = /^2651(\d{8})$/;
const memberIdPattern = /^OC-\d{12,}(?:-(?:S|C\d+|F|M|SF|SM))?$/;
const legacyOcCodePattern = /^OC-\d{4,}(?:-(?:S|C\d+|F|M|SF|SM))?$/;

export function isMemberId(value) {
  const normalized = String(value || '').trim().toUpperCase();
  if (!memberIdPattern.test(normalized)) return false;
  return normalized.slice(7, 9) === MEMBER_ID_FIXED_SEGMENT;
}

export function buildMemberId({ activatedAt, expiresAt, sequence, suffix = '' }) {
  const activationDate = new Date(activatedAt);
  const expiryDate = new Date(expiresAt);
  const number = sequence;
  if (Number.isNaN(activationDate.getTime()) || Number.isNaN(expiryDate.getTime())) {
    throw new TypeError('Member ID activation and expiry dates must be valid.');
  }
  if (!Number.isSafeInteger(number) || number < 1) {
    throw new TypeError('Member ID sequence must be a positive safe integer.');
  }
  if (suffix && !/^(?:S|C\d+|F|M|SF|SM)$/.test(suffix)) {
    throw new TypeError('Member ID suffix is invalid.');
  }
  const joinedYear = String(activationDate.getUTCFullYear()).slice(-2).padStart(2, '0');
  const expiryYear = String(expiryDate.getUTCFullYear()).slice(-2).padStart(2, '0');
  return `OC-${joinedYear}${expiryYear}${MEMBER_ID_FIXED_SEGMENT}${String(number).padStart(6, '0')}${suffix ? `-${suffix}` : ''}`;
}

export function formatMemberCode(code) {
  const normalized = String(code || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!isMemberId(normalized)) {
    throw new TypeError('Member ID must use the current OC member ID format.');
  }
  return normalized;
}

export function isStoredMemberCode(value) {
  const normalized = String(value || '').trim().toUpperCase();
  return isMemberId(normalized)
    || legacyOcCodePattern.test(normalized)
    || /^2651\d{8}$/.test(normalized);
}

export function legacyMemberCodeToMemberNumber(code) {
  const normalized = String(code || '').replace(/\s/g, '');
  const match = normalized.match(legacyMemberCodePattern);
  if (!match) return null;
  const number = Number(match[1]) - 10100000;
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function getMembershipMemberCode(membership) {
  const values = [membership?.memberId, membership?.memberCode, membership?.memberNo];
  return values.map((value) => String(value || '').trim().toUpperCase())
    .find((value) => isMemberId(value)) || '';
}
