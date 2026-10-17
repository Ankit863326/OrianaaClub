// Phase 2: Keep a member's selected plan and draft lifecycle data.
import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  plan: { type: mongoose.Schema.Types.ObjectId, refPath: 'planModel', required: true },
  planModel: { type: String, enum: ['Plan', 'MembershipPlan'], default: 'Plan' },
  status: {
    type: String,
    enum: ['draft', 'pending_payment', 'pending_verification', 'active', 'expired', 'cancelled'],
    default: 'draft',
  },
  memberNumber: {
    type: String,
    default: '',
    validate: (value) => value === '' || /^\d+$/.test(value),
  },
  memberCode: { type: String, trim: true, match: /^2651\d{8}$/ },
  memberId: { type: String, default: '' },
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
    name: 'membership_active_member_code_unique',
    partialFilterExpression: { status: 'active', memberCode: { $type: 'string', $gt: '' } },
  },
);

membershipSchema.pre('validate', function syncMemberReferences() {
  this.user ||= this.customer;
  this.customer ||= this.user;
  if (!this.user || !this.customer) {
    this.invalidate('customer', 'A customer is required.');
  }
});

const Membership = mongoose.models.Membership || mongoose.model('Membership', membershipSchema);

export default Membership;
