const multiply = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const permutation = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhaar(value) {
  if (!/^\d{12}$/.test(value)) return false;
  return [...value].reverse().map(Number).reduce(
    (checksum, digit, index) => multiply[checksum][permutation[index % 8][digit]],
    0,
  ) === 0;
}

export function isValidIdentityNumber(type, input) {
  const value = String(input || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (type === 'pan') return /^[A-Z]{5}\d{4}[A-Z]$/.test(value);
  if (type === 'aadhaar') return isValidAadhaar(value);
  if (type === 'driving_licence') return /^[A-Z]{2}\d{2}\d{4}\d{7,13}$/.test(value);
  if (type === 'passport') return /^[A-Z][1-9]\d{6}$/.test(value);
  return false;
}
