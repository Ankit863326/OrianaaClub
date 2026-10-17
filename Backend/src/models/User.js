// Phase 1: Store member credentials, account status, and verification state.
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    minlength: 2,
    maxlength: 50,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  passwordHash: {
    type: String,
    select: false,
  },
  role: {
    type: String,
    enum: ['member', 'admin'],
    default: 'member',
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended'],
    default: 'pending',
  },
  emailVerified: {
    type: Boolean,
    default: false,
  },
  activationEmailStatus: {
    type: String,
    enum: ['not_sent', 'sent', 'resent', 'failed', 'activated'],
    default: 'not_sent',
  },
  activationEmailSentAt: {
    type: Date,
    default: null,
  },
  activationRequiresMembershipPayment: {
    type: Boolean,
    default: false,
  },
  activatedAt: {
    type: Date,
    default: null,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  deletedAt: {
    type: Date,
    default: null,
    index: true,
  },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);

export default User;
