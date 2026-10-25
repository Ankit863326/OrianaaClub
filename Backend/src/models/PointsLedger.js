import mongoose from 'mongoose';

const pointsLedgerSchema = new mongoose.Schema({
  memberId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  pointsBasis: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  multiplier: { type: Number, required: true, min: 0 },
  phase: { type: String, enum: ['early_bird', 'default'], required: true },
  approvalSeq: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  points: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  creditedAt: { type: Date, required: true, default: Date.now, immutable: true },
  expiresAt: { type: Date, required: true },
  status: { type: String, enum: ['active', 'expired'], default: 'active', index: true },
}, { timestamps: true });

pointsLedgerSchema.index({ memberId: 1, creditedAt: -1 });
const PointsLedger = mongoose.models.PointsLedger
  || mongoose.model('PointsLedger', pointsLedgerSchema);

export default PointsLedger;
