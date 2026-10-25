import mongoose from 'mongoose';
import { DEFAULT_FAMILY_MEMBERSHIP_CONFIG } from './Setting.js';

const auditEntrySchema = new mongoose.Schema({
  status: { type: String, enum: ['not_added', 'pending', 'verified', 'rejected'], required: true },
  action: { type: String, trim: true, default: '' },
  reason: { type: String, trim: true, default: '' },
  ip: { type: String, trim: true, default: '', maxlength: 100 },
  actorId: { type: mongoose.Schema.Types.ObjectId, default: null },
  actorType: { type: String, enum: ['member', 'admin', 'system'], default: 'system' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  at: { type: Date, default: Date.now },
}, { _id: false });

const verificationSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
  status: {
    type: String,
    enum: ['not_added', 'pending', 'verified', 'rejected'],
    default: 'not_added',
    index: true,
  },
  relation: { type: String, enum: ['wife', 'husband', 'child', 'father', 'mother'], default: null },
  emailConfirmedAt: { type: Date, default: null },
  codeSentTo: { type: String, enum: ['own', 'primary'], default: null },
  docType: { type: String, enum: ['aadhaar_digilocker', 'aadhaar_upload'], default: null },
  extraDocType: {
    type: String,
    enum: ['', 'marriage_certificate', 'birth_certificate', 'family_card'],
    default: '',
  },
  aadhaarLast4: { type: String, match: /^\d{4}$/, default: '' },
  aadhaarHash: { type: String, default: '', select: false },
  nameOnDocument: { type: String, trim: true, default: '', maxlength: 120 },
  relationLine: { type: String, trim: true, default: '', maxlength: 240 },
  applicantAddress: { type: String, trim: true, default: '', maxlength: 1000 },
  fileRef: { type: String, default: '' },
  extraDocRef: { type: String, default: '' },
  fileMimeType: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf', ''], default: '' },
  extraDocMimeType: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf', ''], default: '' },
  overdueAt: { type: Date, default: null },
  overdueNotifiedAt: { type: Date, default: null },
  rejectionReason: { type: String, trim: true, default: '' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  reviewedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: null },
  dueAt: { type: Date, default: null },
  auditLog: { type: [auditEntrySchema], default: [] },
}, { timestamps: true });

function addWorkingDays(start, workingDays) {
  const dueAt = new Date(start);
  let daysAdded = 0;
  while (daysAdded < workingDays) {
    dueAt.setUTCDate(dueAt.getUTCDate() + 1);
    const day = dueAt.getUTCDay();
    if (day !== 0 && day !== 6) daysAdded += 1;
  }
  return dueAt;
}

verificationSchema.pre('validate', function setReviewDueAt() {
  if (this.submittedAt && !this.dueAt) {
    this.dueAt = addWorkingDays(
      this.submittedAt,
      DEFAULT_FAMILY_MEMBERSHIP_CONFIG.reviewTargets.verificationWorkingDays,
    );
  }
});
verificationSchema.index(
  { aadhaarHash: 1 },
  { unique: true, partialFilterExpression: { aadhaarHash: { $type: 'string', $gt: '' } } },
);

const Verification = mongoose.models.Verification || mongoose.model('Verification', verificationSchema);

export default Verification;
