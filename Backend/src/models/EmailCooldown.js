// This record limits how often one address can receive each account email.
import mongoose from 'mongoose';

const emailCooldownSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['activation', 'reset'],
    required: true,
  },
  sentAt: {
    type: Date,
    required: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
}, { timestamps: true });

emailCooldownSchema.index({ email: 1, type: 1 }, { unique: true });
emailCooldownSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const EmailCooldown = mongoose.models.EmailCooldown || mongoose.model('EmailCooldown', emailCooldownSchema);

export default EmailCooldown;
