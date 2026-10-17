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
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], required: true },
  relationship: { type: String, required: true, trim: true, maxlength: 40 },
  dob: { type: Date, required: true },
  photoUrl: { type: String, default: '' },
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
    enum: ['draft', 'payment_submitted', 'paid', 'abandoned'],
    default: 'draft',
    index: true,
  },
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
