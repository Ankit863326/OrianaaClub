// Phase 3: Keep an immutable record of every member points credit and debit.
import mongoose from 'mongoose';

const pointsTransactionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
  type: { type: String, enum: ['credit', 'debit'], required: true },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  category: {
    type: String,
    enum: ['membership_award', 'food', 'dance_floor', 'stay', 'spa', 'event', 'other', 'adjustment', 'refund'],
    required: true,
  },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  reference: { type: String, default: '', trim: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  idempotencyKey: { type: String, unique: true, sparse: true, trim: true },
  balanceAfter: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
}, { timestamps: true });

const PointsTransaction = mongoose.models.PointsTransaction
  || mongoose.model('PointsTransaction', pointsTransactionSchema);

export default PointsTransaction;
