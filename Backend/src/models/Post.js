// Phase 5b: Store blog articles and keep publication dates consistent with their status.
import mongoose from 'mongoose';
import { createUniqueSlug, slugify } from '../utils/slugify.js';

const postSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
  excerpt: { type: String, required: true, trim: true, maxlength: 500 },
  content: { type: String, required: true },
  coverImage: { type: String, default: '' },
  category: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  publishedAt: { type: Date, default: null },
}, { timestamps: true });

postSchema.pre('validate', function updatePublishedAt() {
  if (this.status === 'published' && !this.publishedAt) this.publishedAt = new Date();
  if (this.status === 'draft') this.publishedAt = null;
});

postSchema.pre('validate', async function generateSlug() {
  const generatedFromTitle = this.isNew && this.slug?.trim() === slugify(this.title);
  if (!this.slug?.trim() || generatedFromTitle) {
    this.slug = await createUniqueSlug(this.constructor, this.title, this._id, 'post');
  }
});

export default mongoose.models.Post || mongoose.model('Post', postSchema);
