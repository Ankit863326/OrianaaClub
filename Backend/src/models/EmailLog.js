// Phase 1: Record email delivery outcomes without storing token links.
import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
  },
  template: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['sent', 'failed'],
    required: true,
  },
  error: {
    type: String,
    default: '',
  },
}, { timestamps: true });

const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);

export default EmailLog;
