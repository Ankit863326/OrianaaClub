const key = '0123456789abcdef'.repeat(4);
process.env.IDENTITY_DOCUMENT_ENCRYPTION_KEY = key;

const {
  decryptDocumentFile,
  decryptIdentityValue,
  encryptDocumentFile,
  encryptIdentityValue,
} = await import('../src/utils/identityDocumentCrypto.js');
const IdentityVerification = (await import('../src/models/IdentityVerification.js')).default;
const { createMember } = await import('./helpers/factories.js');
const { submitMemberIdentityVerification } = await import('../src/services/identity-verification.service.js');

test('encrypts and decrypts identity values with the configured 32-byte hex key', () => {
  const identityNumber = 'ABCDE1234F';
  const encrypted = encryptIdentityValue(identityNumber);

  expect(encrypted).not.toContain(identityNumber);
  expect(decryptIdentityValue(encrypted)).toBe(identityNumber);
});

test('encrypts uploaded document files and can decrypt them for authorized review', () => {
  const document = Buffer.from('mock identity image data');
  const encrypted = encryptDocumentFile(document);

  expect(encrypted).not.toEqual(document);
  expect(decryptDocumentFile(encrypted)).toEqual(document);
});

test('persists encrypted PAN and Aadhaar values plus Aadhaar last four digits', async () => {
  const { user } = await createMember();
  const documents = [
    { kind: 'pan_front', storageKey: 'pan-front', mimeType: 'image/jpeg' },
    { kind: 'second_front', storageKey: 'aadhaar-front', mimeType: 'image/jpeg' },
    { kind: 'second_back', storageKey: 'aadhaar-back', mimeType: 'image/jpeg' },
  ];

  await submitMemberIdentityVerification(user._id, {
    panNumber: 'ABCDE1234F',
    secondIdType: 'aadhaar',
    secondIdNumber: '236323869904',
  }, documents);

  const stored = await IdentityVerification.findOne({ user: user._id })
    .select('+panCiphertext +idCiphertext +aadhaarLast4 +aadhaarHash')
    .lean();

  expect(decryptIdentityValue(stored.panCiphertext)).toBe('ABCDE1234F');
  expect(decryptIdentityValue(stored.idCiphertext)).toBe('236323869904');
  expect(stored.aadhaarLast4).toBe('9904');
  expect(stored.aadhaarHash).toHaveLength(64);
  expect(stored.panCiphertext).not.toContain('ABCDE1234F');
  expect(stored.idCiphertext).not.toContain('236323869904');
});
