// Phase 2: Store optional family members under the account's membership draft.
import mongoose from 'mongoose';

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
  phone: { type: String, trim: true, default: '' },
  photo: { type: String, trim: true, default: '' },
  photoUrl: { type: String, default: '' },
  idProof: { type: String, trim: true, default: '' },
  idProofStorageKey: { type: String, trim: true, default: '' },
  idProofMimeType: { type: String, trim: true, default: '' },
  idProofOriginalName: { type: String, trim: true, default: '' },
  isNominee: { type: Boolean, default: false },
  isPrimary: { type: Boolean, default: false },
  status: { type: String, enum: ['active', 'pending_approval', 'removed'], default: 'active' },
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
  if (this.isNominee && (this.type !== 'adult' || this.status !== 'active')) {
    this.invalidate('isNominee', 'Only an active adult family member can be a nominee.');
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
