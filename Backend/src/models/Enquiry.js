// Phase 5b: Keep incoming enquiries and internal follow-up notes in one record.
import mongoose from 'mongoose';

const noteSchema = new mongoose.Schema({
  admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  note: { type: String, required: true, trim: true, maxlength: 2000 },
}, { timestamps: { createdAt: true, updatedAt: false } });

const enquirySchema = new mongoose.Schema({
  type: { type: String, enum: ['experience', 'contact', 'query', 'other'], required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  mobile: { type: String, default: '', trim: true, maxlength: 30 },
  message: { type: String, required: true, trim: true, maxlength: 5000 },
  extra: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['new', 'contacted', 'closed'], default: 'new', index: true },
  internalNotes: { type: [noteSchema], default: [] },
}, { timestamps: { createdAt: true, updatedAt: true } });

export default mongoose.models.Enquiry || mongoose.model('Enquiry', enquirySchema);
