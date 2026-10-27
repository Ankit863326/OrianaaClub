// Phase 2: Store optional family members under the account's membership draft.
import mongoose from 'mongoose';
import { isStoredMemberCode, isMemberId } from '../utils/memberCode.js';

const familyMemberSchema = new mongoose.Schema({
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
  linkedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  name: { type: String, trim: true, maxlength: 120 },
  fullName: { type: String, trim: true, maxlength: 120 },
  relation: { type: String, trim: true, maxlength: 40 },
  relationship: { type: String, trim: true, maxlength: 40 },
  gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'], default: 'prefer_not_to_say' },
  dateOfBirth: { type: Date, default: null },
  dob: { type: Date, default: null },
  type: { type: String, enum: ['adult', 'child'], default: 'adult' },
  memberNo: {
    type: String,
    trim: true,
    default: '',
    validate: (value) => value === '' || /^(?:\d+)(?:-(?:S|C\d+|F|M|SF|SM|GM|HR|N\d+))?$/.test(value) || isStoredMemberCode(value),
  },
  memberId: { type: String, default: '', validate: (value) => value == null || value === '' || isMemberId(value) },
  legacyMemberCode: { type: String, trim: true, default: '' },
  familyChildNumber: { type: Number, default: null, min: 1, validate: (value) => value == null || Number.isSafeInteger(value) },
  approvalSeq: {
    type: Number,
    default: null,
    min: 1,
    validate: (value) => value === null || Number.isSafeInteger(value),
  },
  approvedAt: { type: Date, default: null },
  memberType: {
    type: String,
    enum: ['primary', 'spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee'],
    default: 'child',
  },
  linkedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  parentSide: { type: String, enum: ['member', 'spouse', null], default: null },
  tier: { type: String, trim: true, default: '' },
  discountPct: { type: Number, enum: [0, 50, 75], default: 0 },
  email: { type: String, lowercase: true, trim: true, default: '' },
  anniversaryDate: { type: Date, default: null },
  phone: { type: String, trim: true, default: '' },
  photo: { type: String, trim: true, default: '' },
  photoUrl: { type: String, default: '' },
  idProof: { type: String, trim: true, default: '' },
  idProofStorageKey: { type: String, trim: true, default: '' },
  idProofMimeType: { type: String, trim: true, default: '' },
  idProofOriginalName: { type: String, trim: true, default: '' },
  isNominee: { type: Boolean, default: false },
  nomineeRole: { type: String, trim: true, default: '' },
  designation: { type: String, trim: true, default: '' },
  workEmail: { type: String, lowercase: true, trim: true, default: '' },
  emailConfirmedAt: { type: Date, default: null },
  wantsOwnMembership: { type: Boolean, default: false },
  address: { type: String, trim: true, default: '', maxlength: 1000 },
  isPrimary: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'payment_pending', 'pending_approval', 'removed'], default: 'active' },
  baseAmount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  gstAmount: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  totalPaid: { type: Number, default: 0, min: 0, validate: Number.isSafeInteger },
  paymentConfirmedAt: { type: Date, default: null },
  approvalDueAt: { type: Date, default: null },
  approvalOverdueAt: { type: Date, default: null },
  approvalOverdueNotifiedAt: { type: Date, default: null },
  addedBy: { type: String, enum: ['admin', 'member', 'system'], default: 'member' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  pendingAction: { type: String, enum: ['', 'add', 'update', 'remove', 'nominee'], default: '' },
  pendingChanges: { type: mongoose.Schema.Types.Mixed, default: null },
  pendingPhotoUrl: { type: String, default: '' },
}, { timestamps: true });

familyMemberSchema.index(
  { membership: 1, isPrimary: 1 },
  { unique: true, partialFilterExpression: { isPrimary: true } },
);
familyMemberSchema.index(
  { memberNo: 1 },
  { unique: true, partialFilterExpression: { memberNo: { $type: 'string', $gt: '' } } },
);
familyMemberSchema.index(
  { memberId: 1 },
  { unique: true, name: 'family_member_id_unique', partialFilterExpression: { memberId: { $type: 'string', $gt: '' } } },
);

familyMemberSchema.pre('validate', function normalizeFamilyMember() {
  this.name ||= this.fullName;
  this.fullName ||= this.name;
  this.relation ||= this.relationship;
  this.relationship ||= this.relation;
  this.dateOfBirth ||= this.dob;
  this.dob ||= this.dateOfBirth;

  if (!this.name) this.invalidate('name', 'A family member name is required.');
  if (!this.relation) this.invalidate('relation', 'A family member relationship is required.');
  if (this.dateOfBirth && (!this.isModified('type') || !this.type)) {
    this.type = deriveFamilyMemberType(this.dateOfBirth);
  }
  if (this.isNominee && this.type !== 'adult') {
    this.invalidate('isNominee', 'Only an adult family member can be a nominee.');
  }
  if (this.isNominee && !this.approvedAt) {
    this.status = 'pending_approval';
  }
});

export function deriveFamilyMemberType(dateOfBirth, childAgeLimit = 18, today = new Date()) {
  const birthDate = new Date(dateOfBirth);
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDifference = today.getUTCMonth() - birthDate.getUTCMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getUTCDate() < birthDate.getUTCDate())) age -= 1;
  return age < childAgeLimit ? 'child' : 'adult';
}

const FamilyMember = mongoose.models.FamilyMember || mongoose.model('FamilyMember', familyMemberSchema);

export default FamilyMember;
