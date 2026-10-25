import mongoose from 'mongoose';

const draftDocumentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  kind: { type: String, enum: ['pan_front', 'pan_back', 'second_front', 'second_back'], required: true },
  storageKey: { type: String, required: true },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'], required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const familyDraftSchema = new mongoose.Schema({
  id: { type: String, required: true },
  fullName: { type: String, required: true, trim: true, maxlength: 120 },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
  relationship: { type: String, required: true, trim: true, maxlength: 40 },
  dob: { type: Date, default: null },
  photoUrl: { type: String, default: '' },
  memberType: {
    type: String,
    enum: ['spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee'],
    default: 'child',
  },
  isNominee: { type: Boolean, default: false },
  parentSide: { type: String, enum: ['member', 'spouse', null], default: null },
  anniversaryDate: { type: Date, default: null },
  wantsOwnMembership: { type: Boolean, default: false },
  nomineeRole: { type: String, trim: true, default: '' },
  designation: { type: String, trim: true, default: '' },
  email: { type: String, lowercase: true, trim: true, default: '' },
  workEmail: { type: String, lowercase: true, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
}, { _id: false });

const membershipDraftSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, trim: true },
  firstName: { type: String, required: true, trim: true, maxlength: 50 },
  tokenHash: { type: String, required: true, unique: true, select: false },
  otpHash: { type: String, default: '', select: false },
  otpSalt: { type: String, default: '', select: false },
  otpExpiresAt: { type: Date, default: null },
  otpSentAt: { type: Date, default: null },
  otpAttempts: { type: Number, default: 0 },
  emailVerifiedAt: { type: Date, default: null },
  expiresAt: { type: Date, required: true, index: true },
  status: {
    type: String,
    enum: [
      'draft',
      'payment_pending',
      'paid',
      'password_pending',
      'active',
      'failed',
      'payment_submitted',
      'abandoned',
    ],
    default: 'draft',
    index: true,
  },
  currentStep: { type: Number, min: 1, max: 6, default: 1 },
  needsHelp: { type: Boolean, default: false, index: true },
  lastEmailError: { type: String, default: '', maxlength: 1000 },
  adminNotes: { type: String, default: '', maxlength: 2000 },
  profile: { type: mongoose.Schema.Types.Mixed, default: {} },
  family: { type: [familyDraftSchema], default: [] },
  plan: { type: mongoose.Schema.Types.ObjectId, ref: 'MembershipPlan', default: null },
  identity: {
    panCiphertext: { type: String, default: '', select: false },
    panMask: { type: String, default: '' },
    idType: { type: String, enum: ['', 'aadhaar', 'driving_licence', 'passport'], default: '' },
    idCiphertext: { type: String, default: '', select: false },
    idMask: { type: String, default: '' },
    aadhaarLast4: { type: String, default: '', select: false },
    aadhaarHash: { type: String, default: '', select: false },
    consentAt: { type: Date, default: null },
    documents: { type: [draftDocumentSchema], default: [] },
  },
  gstSnapshot: {
    enabled: { type: Boolean, default: null },
    rate: { type: Number, default: null },
    label: { type: String, default: '' },
    planFee: { type: Number, default: null },
    gstAmount: { type: Number, default: null },
    totalAmount: { type: Number, default: null },
  },
  paymentMethod: { type: String, enum: ['', 'razorpay', 'bank_transfer', 'cheque', 'rtgs'], default: '' },
  razorpayOrderId: { type: String, default: '', index: true },
  razorpayPaymentId: { type: String, default: '' },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  convertedAt: { type: Date, default: null },
}, { timestamps: true });

membershipDraftSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { status: 'draft' } },
);

const MembershipDraft = mongoose.models.MembershipDraft
  || mongoose.model('MembershipDraft', membershipDraftSchema);

export default MembershipDraft;
