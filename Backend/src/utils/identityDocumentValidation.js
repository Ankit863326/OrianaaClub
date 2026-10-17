const verhoeffMultiplication = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const verhoeffPermutation = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function isValidAadhaar(value) {
  if (!/^\d{12}$/.test(value)) return false;
  let checksum = 0;
  const digits = value.split('').reverse().map(Number);
  for (let index = 0; index < digits.length; index += 1) {
    checksum = verhoeffMultiplication[checksum][verhoeffPermutation[index % 8][digits[index]]];
  }
  return checksum === 0;
}

export function validateIdentityNumber(type, input) {
  const value = String(input || '').trim().toUpperCase().replace(/[\s-]/g, '');
  if (type === 'pan') {
    return /^[A-Z]{5}\d{4}[A-Z]$/.test(value)
      ? { value, mask: `${value.slice(0, 5)}****${value.slice(-1)}` }
      : null;
  }
  if (type === 'aadhaar') {
    return isValidAadhaar(value)
      ? { value, mask: `XXXX XXXX ${value.slice(-4)}`, last4: value.slice(-4) }
      : null;
  }
  if (type === 'driving_licence') {
    return /^[A-Z]{2}\d{2}\d{4}\d{7,13}$/.test(value)
      ? { value, mask: `${value.slice(0, 4)}${'*'.repeat(Math.max(4, value.length - 8))}${value.slice(-4)}` }
      : null;
  }
  if (type === 'passport') {
    return /^[A-Z][1-9]\d{6}$/.test(value)
      ? { value, mask: `${value.slice(0, 1)}${'*'.repeat(5)}${value.slice(-2)}` }
      : null;
  }
  return null;
}
