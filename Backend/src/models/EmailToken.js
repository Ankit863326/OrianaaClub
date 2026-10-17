// Phase 1: Store hashed, single-use activation and password-reset tokens.
import mongoose from 'mongoose';

const emailTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['activation', 'reset', 'admin-reset'],
    required: true,
  },
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  usedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

emailTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
emailTokenSchema.index({ user: 1, type: 1, usedAt: 1 });

const EmailToken = mongoose.models.EmailToken || mongoose.model('EmailToken', emailTokenSchema);

export default EmailToken;
