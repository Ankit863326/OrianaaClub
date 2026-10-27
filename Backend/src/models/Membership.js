// Phase 2: Keep a member's selected plan and draft lifecycle data.
import mongoose from 'mongoose';
import { isStoredMemberCode, isMemberId } from '../utils/memberCode.js';

const membershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  plan: { type: mongoose.Schema.Types.ObjectId, refPath: 'planModel', required: true },
  planModel: { type: String, enum: ['Plan', 'MembershipPlan'], default: 'Plan' },
  status: {
    type: String,
    enum: [
      'draft',
      'pending_payment',
      'pending_verification',
      'active',
      'expired',
      'cancelled',
      'profile_only',
      'payment_pending',
      'pending_approval',
    ],
    default: 'draft',
  },
  legacyStatus: { type: String, default: '' },
  memberNo: {
    type: String,
    trim: true,
    default: '',
    validate: (value) => value === '' || /^(?:\d+)(?:-(?:S|C\d+|F|M|SF|SM|GM|HR|N\d+))?$/.test(value) || isStoredMemberCode(value),
  },
  approvalSeq: { type: Number, default: null, min: 1, validate: (value) => value === null || Number.isSafeInteger(value) },
  earlyBird: { type: Boolean, default: false },
  memberType: {
    type: String,
    enum: ['primary', 'spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee'],
    default: 'primary',
  },
  linkedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  familyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  parentSide: { type: String, enum: ['member', 'spouse', null], default: null },
  tier: { type: String, trim: true, default: '' },
  discountPct: { type: Number, enum: [0, 50, 75], default: 0 },
  dob: { type: Date, default: null },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say', ''], default: '' },
  photo: { type: String, trim: true, default: '' },
  anniversaryDate: { type: Date, default: null },
  email: { type: String, lowercase: true, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  nomineeRole: { type: String, trim: true, default: '' },
  designation: { type: String, trim: true, default: '' },
  workEmail: { type: String, lowercase: true, trim: true, default: '' },
  emailConfirmedAt: { type: Date, default: null },
  baseAmount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  gstAmount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  totalPaid: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  paymentConfirmedAt: { type: Date, default: null },
  approvedAt: { type: Date, default: null },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvalDueAt: { type: Date, default: null },
  approvalOverdueAt: { type: Date, default: null },
  approvalOverdueNotifiedAt: { type: Date, default: null },
  memberNumber: {
    type: String,
    default: '',
    validate: (value) => value === '' || /^\d+$/.test(value),
  },
  memberCode: { type: String, trim: true, validate: (value) => value == null || value === '' || isStoredMemberCode(value) },
  legacyMemberCode: { type: String, trim: true, default: '' },
  memberId: { type: String, default: '', validate: (value) => value == null || value === '' || isMemberId(value) },
  familyChildSequence: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  termNumber: { type: Number, default: 1, min: 1, validate: Number.isSafeInteger },
  pointsBalance: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  pointsExpiryPendingAmount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  pointsGranted: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  pointsExpireAt: { type: Date, default: null },
  membershipExpireAt: { type: Date, default: null },
  earlyBirdApplied: { type: Boolean, default: false },
  verificationDocs: { type: [mongoose.Schema.Types.Mixed], default: [] },
  eligibilityVerified: { type: Boolean, default: false },
  eligibilityVerifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  eligibilityVerifiedAt: { type: Date, default: null },
  companyDetails: {
    companyName: { type: String, trim: true, default: '' },
    gstNumber: { type: String, trim: true, default: '' },
    contactPerson: { type: String, trim: true, default: '' },
  },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },
  activatedAt: { type: Date, default: null },
  previousMembership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  nominee: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  pendingNominee: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  pendingNomineeRemoval: { type: Boolean, default: false },
  transferDocument: { type: mongoose.Schema.Types.Mixed, default: null },
  familyVersion: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  deactivationReason: { type: String, trim: true, default: '' },
}, { timestamps: true });

membershipSchema.index(
  { user: 1 },
  {
    unique: true,
    name: 'membership_user_pending_unique',
    partialFilterExpression: { status: { $in: ['draft', 'pending_payment', 'pending_verification'] } },
  },
);
membershipSchema.index({ customer: 1 });
membershipSchema.index(
  { familyMember: 1 },
  {
    unique: true,
    name: 'membership_family_member_unique',
    partialFilterExpression: { familyMember: { $type: 'objectId' } },
  },
);
membershipSchema.index(
  { memberNo: 1 },
  { unique: true, partialFilterExpression: { memberNo: { $type: 'string', $gt: '' } } },
);
membershipSchema.index(
  { approvalSeq: 1 },
  { unique: true, partialFilterExpression: { approvalSeq: { $type: 'number' } } },
);
membershipSchema.index({ membershipExpireAt: 1, status: 1 });
membershipSchema.index({ pointsExpireAt: 1, pointsBalance: 1 });
membershipSchema.index(
  { memberNumber: 1 },
  { unique: true, partialFilterExpression: { memberNumber: { $type: 'string', $gt: '' } } },
);
membershipSchema.index(
  { memberCode: 1 },
  {
    unique: true,
    name: 'membership_member_code_unique',
    partialFilterExpression: { memberCode: { $type: 'string', $gt: '' } },
  },
);
membershipSchema.index(
  { memberId: 1 },
  {
    unique: true,
    name: 'membership_member_id_unique',
    partialFilterExpression: { memberId: { $type: 'string', $gt: '' } },
  },
);
membershipSchema.index({ legacyMemberCode: 1 });

membershipSchema.pre('validate', function syncMemberReferences() {
  this.user ||= this.customer;
  this.customer ||= this.user;
  if (!this.user || !this.customer) {
    this.invalidate('customer', 'A customer is required.');
  }
});

const Membership = mongoose.models.Membership || mongoose.model('Membership', membershipSchema);

export default Membership;
