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
    enum: ['queued', 'sent', 'failed', 'skipped'],
    required: true,
  },
  type: {
    type: String,
    enum: ['selected', 'bulk', 'test'],
    default: undefined,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    default: null,
  },
  member: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  skipReason: {
    type: String,
    default: '',
  },
  error: {
    type: String,
    default: '',
  },
}, { timestamps: true });

emailLogSchema.index({ eventId: 1, member: 1, status: 1 });

const EmailLog = mongoose.models.EmailLog || mongoose.model('EmailLog', emailLogSchema);

export default EmailLog;
