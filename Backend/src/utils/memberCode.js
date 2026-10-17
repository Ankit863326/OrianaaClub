const memberCodePrefix = '2651';
const memberNumberLength = 8;

export function generateMemberCode(memberNumber) {
  const value = Number(memberNumber);
  const serial = 10100000 + value;
  if (!Number.isSafeInteger(value) || value < 1 || serial > 99999999) {
    throw new TypeError('Member number must produce an 8-digit serial.');
  }
  return `${memberCodePrefix}${String(serial).padStart(memberNumberLength, '0')}`;
}

export function formatMemberCode(code) {
  const normalized = String(code || '').replace(/[\s-]/g, '');
  if (!/^2651\d{8}$/.test(normalized)) {
    throw new TypeError('Member code must contain 12 digits and start with 2651.');
  }
  return normalized;
}

export function getMembershipMemberCode(membership) {
  const memberNumber = Number(membership?.memberNumber);
  if (Number.isSafeInteger(memberNumber) && memberNumber > 0) {
    return generateMemberCode(memberNumber);
  }
  const storedCode = String(membership?.memberCode || '').replace(/[\s-]/g, '');
  return /^2651\d{8}$/.test(storedCode) && Number(storedCode.slice(4)) > 10100000
    ? storedCode
    : '';
}
