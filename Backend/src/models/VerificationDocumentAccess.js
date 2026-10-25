import mongoose from 'mongoose';

const verificationDocumentAccessSchema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  verificationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Verification', required: true },
  familyMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', required: true },
  documentKind: { type: String, enum: ['document', 'extraDocument'], required: true },
  fileRef: { type: String, required: true },
  mimeType: { type: String, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

verificationDocumentAccessSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationDocumentAccess = mongoose.models.VerificationDocumentAccess
  || mongoose.model('VerificationDocumentAccess', verificationDocumentAccessSchema);

export default VerificationDocumentAccess;
