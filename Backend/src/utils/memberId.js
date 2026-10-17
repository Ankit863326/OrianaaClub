// Phase 4: Format the global membership sequence as a stable member identifier.
export default function memberId(sequence) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new TypeError('Member number must be a positive integer.');
  }
  return `OC-${String(sequence).padStart(6, '0')}`;
}
