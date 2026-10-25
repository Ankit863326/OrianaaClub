// Phase 4: Store payment attempts, verified collections, and refunds in paise.
import mongoose from 'mongoose';

const refundSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  razorpayRefundId: { type: String, default: '' },
  reason: { type: String, required: true, trim: true, maxlength: 500 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true, index: true },
  familyMember: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null, index: true },
  discountPct: { type: Number, enum: [0, 50, 75], default: 0 },
  plan: { type: mongoose.Schema.Types.ObjectId, refPath: 'planModel', required: true },
  planModel: { type: String, enum: ['Plan', 'MembershipPlan'], default: 'Plan' },
  amount: { type: Number, min: 0, validate: (value) => value === undefined || Number.isSafeInteger(value) },
  method: {
    type: String,
    enum: ['razorpay', 'upi', 'card', 'bank_transfer', 'netbanking', 'cheque', 'rtgs', 'manual', 'cash'],
    required: true,
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'pending_verification', 'confirmed', 'paid', 'failed', 'rejected', 'refunded', 'partially_refunded'],
    default: 'created',
    index: true,
  },
  baseAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  gstRate: {
    type: Number,
    min: 0,
    max: 100,
    validate: (value) => value === undefined || Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8,
  },
  gstEnabled: { type: Boolean },
  gstLabel: { type: String, default: 'GST', trim: true, maxlength: 40 },
  gstAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  totalAmount: { type: Number, required: true, min: 0, validate: Number.isSafeInteger },
  currency: { type: String, default: 'INR', enum: ['INR'] },
  razorpayOrderId: { type: String, default: '', index: true },
  razorpayPaymentId: { type: String, default: '' },
  razorpaySignature: { type: String, default: '', select: false },
  reference: { type: String, default: '', trim: true, maxlength: 200 },
  receiptNumber: { type: String, default: '' },
  confirmedAt: { type: Date, default: null },
  recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  razorpayEventIds: { type: [String], default: [] },
  utr: { type: String, default: '', trim: true },
  transferDate: { type: Date, default: null },
  proofUrl: { type: String, default: '' },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '', trim: true, maxlength: 500 },
  invoiceNumber: { type: String, default: '' },
  invoiceGstin: { type: String, default: '', trim: true, maxlength: 30 },
  invoiceHsnSac: { type: String, default: '', trim: true, maxlength: 30 },
  refunds: { type: [refundSchema], default: [] },
  note: { type: String, default: '', trim: true, maxlength: 500 },
}, { timestamps: true });

paymentSchema.index({ utr: 1 }, { unique: true, partialFilterExpression: { utr: { $type: 'string', $gt: '' } } });
paymentSchema.index(
  { receiptNumber: 1 },
  { unique: true, partialFilterExpression: { receiptNumber: { $type: 'string', $gt: '' } } },
);
paymentSchema.index(
  { familyMember: 1 },
  {
    unique: true,
    name: 'family_member_active_payment_unique',
    partialFilterExpression: {
      familyMember: { $type: 'objectId' },
      status: { $in: ['pending', 'created', 'confirmed', 'paid'] },
    },
  },
);

const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

export default Payment;
