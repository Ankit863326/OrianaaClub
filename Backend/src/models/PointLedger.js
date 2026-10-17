import mongoose from 'mongoose';

const pointLedgerSchema = new mongoose.Schema({
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
  type: {
    type: String,
    enum: ['credit_joining', 'credit_renewal', 'debit_redeem', 'refund', 'expire', 'admin_adjust'],
    required: true,
  },
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  direction: { type: String, enum: ['+', '-'], required: true },
  channel: {
    type: String,
    enum: ['admin_manual', 'billing_counter', 'app', 'card'],
    default: 'billing_counter',
  },
  balanceAfter: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  bookingId: { type: String, default: '', trim: true, maxlength: 120 },
  billId: { type: String, default: '', trim: true, maxlength: 120 },
  idempotencyKey: { type: String, trim: true, maxlength: 200 },
  note: { type: String, default: '', trim: true, maxlength: 1000 },
  createdBy: { type: String, enum: ['system', 'admin', 'billing'], required: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
}, { timestamps: { createdAt: true, updatedAt: false } });

pointLedgerSchema.index({ membership: 1, createdAt: -1 });
pointLedgerSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
pointLedgerSchema.pre('save', function preventLedgerUpdates() {
  if (!this.isNew) throw new Error('PointLedger entries are append-only and cannot be changed or deleted.');
});
pointLedgerSchema.pre('deleteOne', { document: true, query: false }, function preventDocumentDelete() {
  throw new Error('PointLedger entries are append-only and cannot be changed or deleted.');
});
pointLedgerSchema.pre(
  ['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'],
  function rejectLedgerMutation() {
    throw new Error('PointLedger entries are append-only and cannot be changed or deleted.');
  },
);

const PointLedger = mongoose.models.PointLedger || mongoose.model('PointLedger', pointLedgerSchema);

export default PointLedger;
