import mongoose from 'mongoose';

const verificationEmailRateLimitSchema = new mongoose.Schema({
  keyHash: { type: String, required: true, unique: true, select: false },
  count: { type: Number, required: true, min: 0 },
  windowStartedAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

verificationEmailRateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const VerificationEmailRateLimit = mongoose.models.VerificationEmailRateLimit
  || mongoose.model('VerificationEmailRateLimit', verificationEmailRateLimitSchema);

export default VerificationEmailRateLimit;
