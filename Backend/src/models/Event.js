// Phase 5b: Store the club's upcoming event catalogue.
import mongoose from 'mongoose';
import { createUniqueSlug, slugify } from '../utils/slugify.js';

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

eventSchema.pre('validate', async function generateSlug() {
  const generatedFromTitle = this.isNew && this.slug?.trim() === slugify(this.title);
  if (!this.slug?.trim() || generatedFromTitle) {
    this.slug = await createUniqueSlug(this.constructor, this.title, this._id, 'event');
  }
});

export default mongoose.models.Event || mongoose.model('Event', eventSchema);
