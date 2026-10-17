// Phase 4: Store named atomic counters for sequential member identifiers.
import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  value: { type: Number, required: true, default: 0, min: 0 },
  key: { type: String, trim: true },
  seq: { type: Number, min: 0, default: 0, validate: Number.isSafeInteger },
}, { timestamps: true });

counterSchema.index({ key: 1 }, { unique: true, sparse: true });

const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

export default Counter;
