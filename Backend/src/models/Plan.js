// Phase 2: Store every display, pricing, points, and family-limit field for a plan.
import mongoose from 'mongoose';

const pointsTierSchema = new mongoose.Schema({
  label: { type: String, required: true },
  points: { type: Number, required: true, min: 0 },
  fromMember: { type: Number, required: true, min: 1 },
  toMember: { type: Number, default: null, min: 1 },
}, { _id: false });

const cohortSchema = new mongoose.Schema({
  amount: { type: Number, required: true, min: 0 },
  label: { type: String, required: true },
}, { _id: false });

const benefitSchema = new mongoose.Schema({
  points: { type: Number, required: true, min: 0 },
  label: { type: String, required: true, trim: true },
}, { _id: false });

const planSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, lowercase: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, default: '', trim: true },
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  termYears: { type: Number, default: 25, min: 1 },
  displayOrder: { type: Number, default: 0, min: 0 },
  benefits: { type: [benefitSchema], default: [] },
  numericPrice: { type: Number, required: true, min: 0 },
  gstPercent: { type: Number, default: 18, min: 0 },
  planFee: { type: Number, required: true, min: 0 },
  gst: { type: Number, required: true, min: 0 },
  // Keep the old checkout calculation separately; Phase 4 will decide the payable rule.
  legacyCheckoutPayable: { type: Number, required: true, min: 0 },
  cohorts: { type: [cohortSchema], default: [] },
  benefitsTitle: { type: String, default: '' },
  benefitsCohorts: { type: [cohortSchema], default: [] },
  pointsTiers: { type: [pointsTierSchema], default: [] },
  maxFamilyMembers: { type: Number, default: 0, min: 0 },
  isFeatured: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 },
  total: { type: Number, min: 0 },
  displayPrice: { type: String, default: '' },
  displayFee: { type: String, default: '' },
  displayGst: { type: String, default: '' },
  displayTotal: { type: String, default: '' },
  badge: { type: String, default: '' },
  color: { type: String, default: '' },
  icon: { type: String, default: '' },
  familyRules: { type: [String], default: [] },
  finalPayableRuleNote: {
    type: String,
    default: 'The final payable amount rule will be decided in Phase 4.',
  },
}, { timestamps: true });

const Plan = mongoose.models.Plan || mongoose.model('Plan', planSchema);

export default Plan;
