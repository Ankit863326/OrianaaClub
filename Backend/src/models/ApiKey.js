import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  keyHash: { type: String, required: true, unique: true, trim: true },
  isActive: { type: Boolean, default: true },
  lastUsedAt: { type: Date, default: null },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: true, updatedAt: false } });

const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;
