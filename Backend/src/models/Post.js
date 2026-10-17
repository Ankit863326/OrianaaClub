// Phase 5b: Store blog articles and keep publication dates consistent with their status.
import mongoose from 'mongoose';

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

export default mongoose.models.Post || mongoose.model('Post', postSchema);
