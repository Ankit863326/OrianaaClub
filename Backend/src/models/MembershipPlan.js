import mongoose from 'mongoose';

const isNonNegativeInteger = (value) => Number.isSafeInteger(value) && value >= 0;

const membershipPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, unique: true, maxlength: 120 },
  price: { type: Number, required: true, min: 0, validate: isNonNegativeInteger },
  earlyBirdPoints: { type: Number, required: true, min: 0, validate: isNonNegativeInteger },
  defaultPoints: { type: Number, required: true, min: 0, validate: isNonNegativeInteger },
  renewalPoints: { type: Number, required: true, min: 0, validate: isNonNegativeInteger },
  isActive: { type: Boolean, default: true },
  requiresVerification: { type: Boolean, default: false },
  requiresCompanyDetails: { type: Boolean, default: false },
  sortOrder: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
}, { timestamps: true });

membershipPlanSchema.index({ sortOrder: 1 });

const MembershipPlan = mongoose.models.MembershipPlan
  || mongoose.model('MembershipPlan', membershipPlanSchema);

export default MembershipPlan;
