import { jest } from '@jest/globals';
import ApiError from '../src/utils/ApiError.js';
import asyncHandler from '../src/utils/asyncHandler.js';
import { calculateGst, getPayableAmount, paiseToRupees, rupeesToPaise } from '../src/utils/money.js';
import { buildMemberId } from '../src/utils/memberCode.js';
import { safeCsvCell, writeCsvHeader, writeCsvRow } from '../src/utils/csv.js';
import * as auth from '../src/validators/auth.schema.js';
import * as member from '../src/validators/member.schema.js';
import * as family from '../src/validators/family.schema.js';
import * as payment from '../src/validators/payment.schema.js';
import * as admin from '../src/validators/admin.schema.js';
import * as content from '../src/validators/content.schema.js';
import * as points from '../src/validators/points.schema.js';
import {
  membershipPurchaseSchema,
  membershipRenewalSchema,
  offlinePaymentSchema,
} from '../src/validators/membership-purchase.schema.js';
import {
  identityReviewSchema,
  identityVerificationSchema,
} from '../src/validators/identity-verification.schema.js';
import { validateIdentityNumber } from '../src/utils/identityDocumentValidation.js';
import IdentityVerification from '../src/models/IdentityVerification.js';
import { membershipDraftFamilyMemberSchema } from '../src/validators/membership-draft.schema.js';

// Small focused tests document how common money and formatting helpers behave.
describe('utility functions', () => {
  test('converts money without losing paise and calculates GST', () => {
    expect(calculateGst(100, 18)).toBe(18);
    expect(rupeesToPaise(12.34)).toBe(1234);
    expect(paiseToRupees(1234)).toBe(12.34);
    expect(getPayableAmount({ price: 100 })).toEqual({
      baseAmount: 10000,
      gstRate: 18,
      gstEnabled: true,
      gstLabel: 'GST',
      gstAmount: 1800,
      totalAmount: 11800,
      currency: 'INR',
    });
  });

  test('calculates GST in paise from a configurable rate and respects disabled tax', () => {
    expect(getPayableAmount({ price: 2500000 }, { enabled: true, rate: 18, label: 'GST' }))
      .toMatchObject({ baseAmount: 250000000, gstAmount: 45000000, totalAmount: 295000000 });
    expect(getPayableAmount({ price: 2500000 }, { enabled: true, rate: 5, label: 'Tax' }))
      .toMatchObject({ gstRate: 5, gstLabel: 'Tax', gstAmount: 12500000, totalAmount: 262500000 });
    expect(getPayableAmount({ price: 2500000 }, { enabled: false, rate: 18 }))
      .toMatchObject({ gstEnabled: false, gstAmount: 0, totalAmount: 250000000 });
  });

  test.each([-1, NaN, Infinity])('rejects invalid rupee amount %s', (amount) => {
    expect(() => rupeesToPaise(amount)).toThrow(TypeError);
  });

  test('rejects invalid GST values and unsafe paise conversions', () => {
    expect(() => calculateGst(-1)).toThrow(TypeError);
    expect(() => calculateGst(1, NaN)).toThrow(TypeError);
    expect(() => rupeesToPaise(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(() => paiseToRupees(1.5)).toThrow(TypeError);
    expect(() => getPayableAmount({ price: -1 })).toThrow(TypeError);
    expect(() => getPayableAmount({ price: 100 }, { enabled: true, rate: 18.001 })).toThrow(TypeError);
  });

  test('accepts RTGS only for new membership purchases and rejects cash', () => {
    const planId = '0123456789abcdef01234567';
    for (const paymentMethod of ['razorpay', 'bank_transfer', 'cheque']) {
      const payload = { planId, paymentMethod };
      expect(membershipPurchaseSchema.safeParse(payload).success).toBe(true);
      expect(membershipRenewalSchema.safeParse(payload).success).toBe(true);
    }
    expect(membershipPurchaseSchema.safeParse({
      planId,
      paymentMethod: 'rtgs',
      rtgsDetails: { utr: 'ABCD12345678', transferDate: '2026-04-10' },
    }).success).toBe(true);
    expect(membershipPurchaseSchema.safeParse({
      planId,
      paymentMethod: 'rtgs',
    }).success).toBe(false);
    expect(membershipRenewalSchema.safeParse({ planId, paymentMethod: 'rtgs' }).success).toBe(false);
    for (const paymentMethod of ['cash', 'manual', 'netbanking']) {
      const payload = { planId, paymentMethod };
      expect(membershipPurchaseSchema.safeParse(payload).success).toBe(false);
      expect(membershipRenewalSchema.safeParse(payload).success).toBe(false);
      expect(offlinePaymentSchema.safeParse({
        membershipId: planId,
        method: paymentMethod,
      }).success).toBe(true);
    }
    expect(offlinePaymentSchema.safeParse({
      membershipId: planId,
      method: 'cheque',
    }).success).toBe(true);
    expect(offlinePaymentSchema.safeParse({
      membershipId: planId,
      method: 'bank_transfer',
    }).success).toBe(false);
    for (const method of ['bank_transfer', 'cheque']) {
      expect(offlinePaymentSchema.safeParse({
        membershipId: planId,
        method,
        reference: 'UTR-123',
      }).success).toBe(true);
    }
    expect(offlinePaymentSchema.safeParse({
      membershipId: planId,
      method: 'rtgs',
      reference: 'ABCD12345678',
      paymentDate: '2026-04-10',
    }).success).toBe(true);
    expect(offlinePaymentSchema.safeParse({
      membershipId: planId,
      method: 'rtgs',
      reference: 'AB',
      paymentDate: '2026-04-10',
    }).success).toBe(false);
  });

  test('requires a reason and transfer reference when an admin changes payment details', () => {
    const change = admin.paymentMethodChangeSchema;
    expect(change.safeParse({
      method: 'bank_transfer',
      reference: 'UTR-123456',
      reason: 'Corrected method',
    }).success).toBe(true);
    expect(change.safeParse({
      method: 'bank_transfer',
      reason: 'Corrected method',
    }).success).toBe(false);
    expect(change.safeParse({
      method: 'cheque',
      reason: 'Corrected method',
    }).success).toBe(true);
    expect(change.safeParse({
      method: 'cash',
    }).success).toBe(false);
  });

  test('rejects unsupported offline methods when an admin creates a member payment', () => {
    const payload = {
      user: { firstName: 'Test', email: 'a@example.invalid' },
      profile: { ...validProfile },
      planSlug: 'standard',
      offlinePayment: {
        method: 'cash',
        reference: 'CASH-123',
        amountPaise: '100',
        note: 'Paid',
      },
    };
    expect(admin.manualMemberSchema.safeParse(payload).success).toBe(false);
    expect(admin.manualMemberSchema.safeParse({
      ...payload,
      offlinePayment: { ...payload.offlinePayment, method: 'bank_transfer' },
    }).success).toBe(true);
  });

  test('validates and masks the supported identity number formats', () => {
    expect(validateIdentityNumber('pan', 'abcde1234f')).toMatchObject({
      value: 'ABCDE1234F',
      mask: 'ABCDE****F',
    });
    expect(validateIdentityNumber('pan', 'ABCDE12345')).toBeNull();
    expect(validateIdentityNumber('aadhaar', '236323869904')).toMatchObject({
      mask: 'XXXX XXXX 9904',
      last4: '9904',
    });
    expect(validateIdentityNumber('aadhaar', '236323869905')).toBeNull();
    expect(validateIdentityNumber('driving_licence', 'MH0120200012345')).not.toBeNull();
    expect(validateIdentityNumber('passport', 'A1234567')).not.toBeNull();
    expect(validateIdentityNumber('passport', 'A0234567')).toBeNull();
  });

  test('requires consent and three-document identity verification data', () => {
    expect(identityVerificationSchema.safeParse({
      panNumber: 'ABCDE1234F',
      secondIdType: 'aadhaar',
      secondIdNumber: '236323869904',
      consent: 'true',
    }).success).toBe(true);
    expect(identityVerificationSchema.safeParse({
      panNumber: 'ABCDE1234F',
      secondIdType: 'aadhaar',
      secondIdNumber: '236323869904',
      consent: 'false',
    }).success).toBe(false);
    expect(identityReviewSchema.safeParse({ status: 'verified' }).success).toBe(true);
    expect(identityReviewSchema.safeParse({ status: 'rejected', reason: 'Unreadable image' }).success).toBe(true);
    expect(identityReviewSchema.safeParse({ status: 'rejected', reason: '' }).success).toBe(false);
    expect(IdentityVerification.schema.path('aadhaarNumber')).toBeUndefined();
    expect(IdentityVerification.schema.path('aadhaarLast4').options.select).toBe(false);
    expect(IdentityVerification.schema.path('aadhaarHash').options.select).toBe(false);
    expect(IdentityVerification.schema.path('documents').schema.path('kind').enumValues)
      .toContain('pan_back');
  });

  test('formats date-based member IDs and rejects invalid sequences', () => {
    const dates = {
      activatedAt: new Date('2026-10-27T00:00:00.000Z'),
      expiresAt: new Date('2051-10-27T00:00:00.000Z'),
    };
    expect(buildMemberId({ ...dates, sequence: 1 })).toBe('OC-265111000001');
    expect(buildMemberId({ ...dates, sequence: 1234567 })).toBe('OC-2651111234567');
    for (const value of [0, -1, 1.2, Number.MAX_SAFE_INTEGER + 1, '1']) {
      expect(() => buildMemberId({ ...dates, sequence: value })).toThrow(TypeError);
    }
  });

  test('quotes CSV and neutralizes spreadsheet formulas', () => {
    expect(safeCsvCell('a,"b"')).toBe('"a,""b"""');
    for (const formula of ['=1+1', '+SUM(A1:A2)', '-1+2', '@cmd', '  =2']) {
      expect(safeCsvCell(formula)).toBe(`"'${formula.replaceAll('"', '""')}"`);
    }
    expect(safeCsvCell(null)).toBe('""');
    const output = [];
    const response = {
      setHeader: (name, value) => output.push(`${name}:${value}`),
      write: (value) => output.push(value),
    };
    writeCsvHeader(response, 'members.csv', ['Name', 'Email']);
    writeCsvRow(response, ['A', 'a@example.invalid']);
    expect(output.slice(-2)).toEqual(['"Name","Email"\r\n', '"A","a@example.invalid"\r\n']);
  });

  test('keeps API errors identifiable and forwards async failures', async () => {
    const error = new ApiError(409, 'Conflict');
    expect(error).toMatchObject({ name: 'ApiError', statusCode: 409, message: 'Conflict' });
    const next = jest.fn();
    const wrapped = asyncHandler(async () => { throw error; });
    await wrapped({}, {}, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});

const validId = '0123456789abcdef01234567';
const goodPassword = 'PassWord123';
const date = '1990-01-01';
const validPost = {
  title: 'A post', slug: 'a-post', excerpt: 'Short excerpt', content: 'Full post content',
  category: 'Travel', status: 'published',
};
const validEvent = {
  title: 'A party', slug: 'a-party', description: 'A great party', date,
  location: 'Mumbai', status: 'published',
};
const validProfile = {
  fullName: 'Test Member', gender: 'other', countryCode: '+91', mobile: '9000000000',
  dob: date, interestArea: 'Travel',
};
const transaction = {
  membershipId: validId, amount: 10, category: 'food', reason: 'Dinner',
};

const schemaCases = [
  [auth.registerSchema, { firstName: 'Test', email: 'a@example.invalid' }, { firstName: ' Ann ', email: 'A@example.invalid' }],
  [auth.resendActivationSchema, { email: 'a@example.invalid' }, { email: ' A@EXAMPLE.INVALID ' }],
  [auth.activateVerifySchema, { token: 'a'.repeat(64) }, { token: ` ${'A'.repeat(64)} ` }],
  [auth.activateSchema,
    { token: 'a'.repeat(64), password: goodPassword, confirmPassword: goodPassword },
    { token: ` ${'A'.repeat(64)} `, password: goodPassword, confirmPassword: goodPassword }],
  [auth.setOnboardingPasswordSchema, { password: goodPassword, confirmPassword: goodPassword }, { password: goodPassword, confirmPassword: goodPassword }],
  [auth.loginSchema, { email: 'a@example.invalid', password: 'x' }, { email: ' A@EXAMPLE.INVALID ', password: 'x' }],
  [auth.forgotPasswordSchema, { email: 'a@example.invalid' }, { email: ' A@EXAMPLE.INVALID ' }],
  [auth.resetPasswordSchema, { token: 'x', password: goodPassword, confirmPassword: goodPassword }, { token: 'x', password: goodPassword, confirmPassword: goodPassword }],
  [member.profileSchema, validProfile, { ...validProfile, agreePromo: 'true' }],
  [member.planSelectionSchema, { planId: validId }, { planId: validId.toUpperCase() }],
  [member.familyMemberSchema, { ...validProfile, relationship: 'Sibling' }, { ...validProfile, relationship: ' Sibling ' }],
  [member.familyIdSchema, { id: validId }, { id: validId.toUpperCase() }],
  [payment.membershipPaymentParamsSchema, { membershipId: validId }, { membershipId: validId.toUpperCase() }],
  [payment.createPaymentOrderSchema, { membershipId: validId, method: 'upi' }, { membershipId: validId, method: 'card' }],
  [payment.verifyPaymentSchema, { razorpay_order_id: 'order1', razorpay_payment_id: 'pay1', razorpay_signature: 'a'.repeat(64) }, { razorpay_order_id: ' order1 ', razorpay_payment_id: ' pay1 ', razorpay_signature: 'A'.repeat(64) }],
  [admin.paginationSchema, {}, { page: '1', limit: '100' }],
  [admin.membersQuerySchema, {}, { search: ' Test ', status: 'active', sort: 'email', order: 'desc' }],
  [admin.userParamsSchema, { userId: validId }, { userId: validId.toUpperCase() }],
  [admin.idParamsSchema, { id: validId }, { id: validId.toUpperCase() }],
  [admin.familyParamsSchema, { userId: validId, familyId: validId }, { userId: validId.toUpperCase(), familyId: validId.toUpperCase() }],
  [admin.memberPatchSchema, { firstName: 'Test' }, { email: ' A@EXAMPLE.INVALID ' }],
  [admin.manualMemberSchema, { user: { firstName: 'Test', email: 'a@example.invalid' }, profile: { ...validProfile }, planSlug: 'standard' }, { user: { firstName: 'Test', email: 'a@example.invalid' }, profile: { ...validProfile }, planSlug: 'standard', offlinePayment: { method: 'bank_transfer', reference: 'UTR-123', amountPaise: '100', note: 'Paid' } }],
  [admin.planBodySchema, { title: 'Standard', price: 1, gstPercent: 18, planFee: 1, pointsTiers: [], maxFamilyMembers: 0, isActive: true, isFeatured: false, sortOrder: 0, slug: 'standard' }, { title: 'Standard', price: '1', gstPercent: '18', planFee: '1', pointsTiers: [], maxFamilyMembers: '0', isActive: true, isFeatured: false, sortOrder: '0', id: 'standard', slug: 'standard' }],
  [admin.planPatchSchema, { title: 'Standard' }, { price: '1' }],
  [admin.familyPatchSchema, { relationship: 'Sibling' }, { relationship: ' Sibling ' }],
  [admin.paymentsQuerySchema, {}, { status: 'paid', method: 'bank_transfer', from: '2020-01-01', to: '2020-12-31' }],
  [admin.refundBodySchema, { amount: 1, reason: 'Refund' }, { amount: '100', reason: ' Refund ', reversePoints: true }],
  [admin.rejectPaymentSchema, { reason: 'Rejected' }, { reason: ' Rejected ' }],
  [content.slugParamsSchema, { slug: 'a-post' }, { slug: ' A-POST ' }],
  [content.contentIdParamsSchema, { id: validId }, { id: validId.toUpperCase() }],
  [content.postCreateSchema, validPost, { ...validPost, coverImage: '/media/12345678-1234-1234-1234-123456789012.jpg' }],
  [content.postPatchSchema, { title: 'Updated' }, { status: 'draft' }],
  [content.eventCreateSchema, validEvent, { ...validEvent, capacity: '' }],
  [content.eventPatchSchema, { title: 'Updated' }, { capacity: '3' }],
  [content.publicPostsQuerySchema, {}, { page: '1', limit: '100', category: ' Travel ' }],
  [content.adminPostsQuerySchema, {}, { status: 'published' }],
  [content.adminEventsQuerySchema, {}, { status: 'cancelled' }],
  [content.enquiryCreateSchema, { type: 'query', name: 'Test', email: 'a@example.invalid', message: 'Help' }, { type: 'other', name: ' Test ', email: 'A@EXAMPLE.INVALID', message: ' Help ', extra: { consent: true } }],
  [content.enquiriesQuerySchema, {}, { from: '2020-01-01', to: '2020-12-31', status: 'new' }],
  [content.enquiryStatusSchema, { status: 'new' }, { status: 'closed' }],
  [content.enquiryNoteSchema, { note: 'Note' }, { note: ' Note ' }],
  [content.adminsQuerySchema, {}, { status: 'active', search: ' admin ' }],
  [content.adminCreateSchema, { firstName: 'Test', email: 'a@example.invalid' }, { firstName: ' Test ', email: 'A@EXAMPLE.INVALID' }],
  [content.adminStatusSchema, { status: 'active' }, { status: 'suspended' }],
  [content.auditQuerySchema, {}, { from: '2020-01-01', to: '2020-12-31', admin: validId }],
  [content.emailLogsQuerySchema, {}, { status: 'failed', search: 'a@example.invalid' }],
  [content.reportQuerySchema, {}, { from: '2020-01-01', to: '2020-12-31' }],
  [content.reportExportSchema, { report: 'members-by-plan' }, { report: 'revenue-by-month', from: '2020-01-01', to: '2020-12-31' }],
  [points.pointsHistorySchema, {}, { page: '1', limit: '100', type: 'credit', category: 'food', from: '2020-01-01' }],
  [points.pointsCreditSchema, transaction, { ...transaction, amount: '10', idempotencyKey: 'key1' }],
  [points.pointsDebitSchema, transaction, { ...transaction, amount: '10' }],
  [points.pointsBulkCreditSchema, { membershipIds: [validId], amount: 1, reason: 'Award' }, { filter: { planSlug: 'standard' }, amount: 1, reason: 'Award' }],
  [points.pointsUserParamsSchema, { userId: validId }, { userId: validId.toUpperCase() }],
];

// Each public Zod schema gets valid, invalid, and boundary-style input coverage.
describe.each(schemaCases.map((testCase, index) => [index, ...testCase]))('schema #%i', (index, schema, validValue, edgeValue) => {
  test('accepts a valid value', () => {
    expect(schema.safeParse(validValue).success).toBe(true);
  });

  test('rejects a value with an invalid type or required field', () => {
    expect(schema.safeParse(null).success).toBe(false);
  });

  test('handles boundary and normalization input', () => {
    expect(schema.safeParse(edgeValue).success).toBe(true);
  });
});

test('cross-field validation rejects invalid password and date ranges', () => {
  expect(auth.setOnboardingPasswordSchema.safeParse({
    password: goodPassword, confirmPassword: 'OtherPassword123',
  }).success).toBe(false);
  expect(admin.paymentsQuerySchema.safeParse({ from: '2022-01-01', to: '2021-01-01' }).success).toBe(false);
  expect(content.enquiriesQuerySchema.safeParse({ from: '2022-01-01', to: '2021-01-01' }).success).toBe(false);
  expect(points.pointsBulkCreditSchema.safeParse({
    membershipIds: [validId], filter: { planSlug: 'standard' }, amount: 1, reason: 'Award',
  }).success).toBe(false);
});

test('family side is optional for non-parents and required for parents', () => {
  const spouse = membershipDraftFamilyMemberSchema.safeParse({
    fullName: 'Sam Spouse',
    gender: 'female',
    relationship: 'Spouse',
    memberType: 'spouse',
    dob: '1990-01-01',
    parentSide: '',
  });
  expect(spouse.success).toBe(true);
  expect(spouse.data.parentSide).toBeUndefined();

  const child = membershipDraftFamilyMemberSchema.safeParse({
    fullName: 'Sam Child',
    gender: 'male',
    relationship: 'Son',
    memberType: 'child',
    dob: '2015-01-01',
    parentSide: '',
  });
  expect(child.success).toBe(true);
  expect(child.data.parentSide).toBeUndefined();

  const nominee = membershipDraftFamilyMemberSchema.safeParse({
    fullName: 'Sam Nominee',
    gender: 'prefer_not_to_say',
    relationship: 'Nominee',
    memberType: 'nominee',
    isNominee: true,
    dob: '',
    workEmail: 'nominee@example.invalid',
    parentSide: '',
  });
  expect(nominee.success).toBe(true);
  expect(nominee.data.parentSide).toBeUndefined();

  const parent = membershipDraftFamilyMemberSchema.safeParse({
    fullName: 'Sam Parent',
    gender: 'female',
    relationship: 'Mother',
    memberType: 'mother',
    dob: '1960-01-01',
    parentSide: '',
  });
  expect(parent.success).toBe(false);
  expect(parent.error.issues.some((issue) => issue.path.includes('parentSide'))).toBe(true);

  const memberSpouse = member.familyMemberSchema.safeParse({
    fullName: 'Sam Spouse',
    gender: 'female',
    relationship: 'Spouse',
    memberType: 'spouse',
    dob: '1990-01-01',
    parentSide: '',
  });
  expect(memberSpouse.success).toBe(true);
  expect(memberSpouse.data.parentSide).toBeUndefined();

  const memberParent = member.familyMemberSchema.safeParse({
    fullName: 'Sam Parent',
    gender: 'female',
    relationship: 'Mother',
    memberType: 'mother',
    dob: '1960-01-01',
    parentSide: '',
  });
  expect(memberParent.success).toBe(false);
  expect(memberParent.error.issues.some((issue) => issue.path.includes('parentSide'))).toBe(true);

  expect(family.familyMemberSchema.safeParse({
    name: 'Sam Spouse', relation: 'Spouse', parentSide: '',
  }).success).toBe(true);
  expect(family.familyMemberSchema.safeParse({
    name: 'Sam Parent', relation: 'Mother', parentSide: '',
  }).success).toBe(false);
});
