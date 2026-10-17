import mongoose from 'mongoose';

const nonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;
const redemptionSchema = new mongoose.Schema({
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
  memberCode: { type: String, required: true, trim: true, match: /^2651\d{8}$/ },
  billId: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
  bookingId: { type: String, default: '', trim: true, maxlength: 120 },
  channel: {
    type: String,
    enum: ['admin_manual', 'billing_counter', 'app', 'card'],
    default: 'billing_counter',
  },
  serviceType: {
    type: String,
    enum: ['lawn', 'banquet', 'villa', 'resort', 'shoot', 'birthday', 'reunion', 'other'],
    required: true,
  },
  eventDate: { type: Date, required: true },
  billAmount: { type: Number, required: true, min: 0, validate: nonNegativeInteger },
  discountPercent: { type: Number, required: true, min: 0, max: 100, validate: nonNegativeInteger },
  discountedAmount: { type: Number, required: true, min: 0, validate: nonNegativeInteger },
  pointsUsed: { type: Number, required: true, min: 0, validate: nonNegativeInteger },
  remainingToPay: { type: Number, required: true, min: 0, validate: nonNegativeInteger },
  balanceAfter: { type: Number, required: true, min: 0, validate: nonNegativeInteger },
  familyMemberId: { type: mongoose.Schema.Types.ObjectId, ref: 'FamilyMember', default: null },
  status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
  cancelledAt: { type: Date, default: null },
  refundedPoints: { type: Number, default: 0, min: 0, validate: nonNegativeInteger },
  createdByApiKey: { type: mongoose.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
}, { timestamps: true });

redemptionSchema.index({ membership: 1, createdAt: -1 });

const Redemption = mongoose.models.Redemption || mongoose.model('Redemption', redemptionSchema);

export default Redemption;
