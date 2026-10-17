// Phase 5b: Store the club's upcoming event catalogue.
import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  date: { type: Date, required: true, index: true },
  time: { type: String, default: '', trim: true, maxlength: 80 },
  location: { type: String, required: true, trim: true, maxlength: 180 },
  image: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'published', 'cancelled'], default: 'draft', index: true },
  capacity: { type: Number, min: 1, default: null },
}, { timestamps: true });

export default mongoose.models.Event || mongoose.model('Event', eventSchema);
