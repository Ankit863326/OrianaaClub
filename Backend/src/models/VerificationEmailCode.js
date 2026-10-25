import mongoose from 'mongoose';

const verificationEmailCodeSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true, index: true },
  codeHash: { type: String, required: true, select: false },
  recipientHash: { type: String, required: true, select: false },
  ipHash: { type: String, required: true, select: false },
  sentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  attempts: { type: Number, default: 0, min: 0, max: 5 },
  sendCount: { type: Number, default: 0, min: 0 },
  windowStartedAt: { type: Date, required: true },
  verifiedAt: { type: Date, default: null },
}, { timestamps: true });

verificationEmailCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationEmailCode = mongoose.models.VerificationEmailCode
  || mongoose.model('VerificationEmailCode', verificationEmailCodeSchema);

export default VerificationEmailCode;
