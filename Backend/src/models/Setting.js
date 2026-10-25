import mongoose from 'mongoose';

const DEFAULT_SETTINGS_ID = 'global';
const SETTINGS_CACHE_TTL_MS = 30_000;

export const DEFAULT_FAMILY_MEMBERSHIP_CONFIG = {
  gstPct: 18,
  pointsOnBase: true,
  multipliers: { earlyBird: 2, default: 1.6 },
  earlyBirdLimit: 1000,
  pointExpiryYears: 11,
  discounts: { spouse: 50, parent: 50, child: 75 },
  childMaxAge: 18,
  limits: { spouse: 1, parents: 4, parentsPerSide: 2, children: null },
  reviewTargets: { verificationWorkingDays: 1, approvalHours: 24 },
  nomineesTakeApprovalSeq: true,
  tiers: [
    { tier: 'founder-legacy', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
    { tier: 'platinum-crest', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
    { tier: 'imperial-signature', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
    { tier: 'presidential-elite', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
    { tier: 'chairmans-privilege', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
    { tier: 'founder-circle', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
    { tier: 'corporate', familyEnabled: false, nomineesEnabled: true, maxNominees: 2, nomineeRoles: ['GM', 'HR'] },
    { tier: 'privileged', familyEnabled: true, nomineesEnabled: true, maxNominees: 2, nomineeRoles: 'free_text' },
  ],
};

const tierConfigSchema = new mongoose.Schema({
  tier: { type: String, required: true, trim: true },
  familyEnabled: { type: Boolean, required: true },
  nomineesEnabled: {
    type: Boolean,
    default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.tiers[0].nomineesEnabled,
  },
  maxNominees: {
    type: Number,
    default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.tiers[0].maxNominees,
    min: 0,
    validate: Number.isSafeInteger,
  },
  nomineeRoles: {
    type: mongoose.Schema.Types.Mixed,
    default: 'free_text',
    validate: (value) => value === 'free_text'
      || (Array.isArray(value) && value.every((role) => typeof role === 'string' && role.trim())),
  },
}, { _id: false });

const familyMembershipConfigSchema = new mongoose.Schema({
  gstPct: { type: Number, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.gstPct, min: 0, max: 100 },
  pointsOnBase: { type: Boolean, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.pointsOnBase },
  multipliers: {
    earlyBird: { type: Number, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.multipliers.earlyBird, min: 0 },
    default: { type: Number, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.multipliers.default, min: 0 },
  },
  earlyBirdLimit: {
    type: Number,
    default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.earlyBirdLimit,
    min: 0,
    validate: Number.isSafeInteger,
  },
  pointExpiryYears: {
    type: Number,
    default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.pointExpiryYears,
    min: 1,
    validate: Number.isSafeInteger,
  },
  discounts: {
    spouse: { type: Number, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.discounts.spouse, enum: [0, 50, 75] },
    parent: { type: Number, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.discounts.parent, enum: [0, 50, 75] },
    child: { type: Number, default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.discounts.child, enum: [0, 50, 75] },
  },
  childMaxAge: {
    type: Number,
    default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.childMaxAge,
    min: 0,
    validate: Number.isSafeInteger,
  },
  limits: {
    spouse: {
      type: Number,
      default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits.spouse,
      min: 0,
      validate: Number.isSafeInteger,
    },
    parents: {
      type: Number,
      default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits.parents,
      min: 0,
      validate: Number.isSafeInteger,
    },
    parentsPerSide: {
      type: Number,
      default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits.parentsPerSide,
      min: 0,
      validate: Number.isSafeInteger,
    },
    children: {
      type: Number,
      default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits.children,
      min: 0,
      validate: (value) => value === null || Number.isSafeInteger(value),
    },
  },
  reviewTargets: {
    verificationWorkingDays: {
      type: Number,
      default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.reviewTargets.verificationWorkingDays,
      min: 0,
      validate: Number.isSafeInteger,
    },
    approvalHours: {
      type: Number,
      default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.reviewTargets.approvalHours,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  nomineesTakeApprovalSeq: {
    type: Boolean,
    default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.nomineesTakeApprovalSeq,
  },
  tiers: { type: [tierConfigSchema], default: DEFAULT_FAMILY_MEMBERSHIP_CONFIG.tiers },
}, { _id: false });

const settingSchema = new mongoose.Schema({
  _id: { type: String, default: DEFAULT_SETTINGS_ID },
  discountPercent: { type: Number, default: 50, min: 0, max: 100, validate: Number.isSafeInteger },
  gstEnabled: { type: Boolean, default: true },
  gstRate: { type: Number, default: 18, min: 0, max: 100 },
  gstLabel: { type: String, default: 'GST', trim: true, maxlength: 40 },
  gstin: { type: String, default: '', trim: true, maxlength: 30 },
  pointsValidityYears: { type: Number, default: 11, min: 1, validate: Number.isSafeInteger },
  membershipValidityYears: { type: Number, default: 25, min: 1, validate: Number.isSafeInteger },
  maxFamilyMembers: { type: Number, default: 6, min: 0, validate: Number.isSafeInteger },
  familyMembership: {
    type: familyMembershipConfigSchema,
    default: () => DEFAULT_FAMILY_MEMBERSHIP_CONFIG,
  },
  childAgeLimit: { type: Number, default: 18, min: 0, validate: Number.isSafeInteger },
  earlyBirdLimit: { type: Number, default: 1000, min: 0, validate: Number.isSafeInteger },
  receiptCompanyName: {
    type: String,
    default: 'Orianaa by Saptagiri Hospitality & Lifestyle Pvt. Ltd.',
    trim: true,
    maxlength: 160,
  },
  receiptAddress: { type: String, default: '', trim: true, maxlength: 500 },
  receiptGstin: { type: String, default: '', trim: true, maxlength: 30 },
  receiptHsnSac: { type: String, default: '', trim: true, maxlength: 30 },
  receiptFooterNote: { type: String, default: '', trim: true, maxlength: 500 },
}, { timestamps: true, id: false });

let cachedSettings;
let cacheExpiresAt = 0;

settingSchema.pre('validate', function enforceSingleton() {
  if (this._id !== DEFAULT_SETTINGS_ID) {
    this.invalidate('_id', `Settings must use the singleton identifier "${DEFAULT_SETTINGS_ID}".`);
  }
});
settingSchema.post('save', () => invalidateSettingsCache());
settingSchema.post('findOneAndUpdate', () => invalidateSettingsCache());
settingSchema.post('updateOne', () => invalidateSettingsCache());
settingSchema.post('replaceOne', () => invalidateSettingsCache());
settingSchema.post('deleteOne', () => invalidateSettingsCache());
settingSchema.post('findOneAndDelete', () => invalidateSettingsCache());
settingSchema.post('deleteMany', () => invalidateSettingsCache());

export function invalidateSettingsCache() {
  cachedSettings = undefined;
  cacheExpiresAt = 0;
}

export async function getSettings({ forceRefresh = false } = {}) {
  if (!forceRefresh && cachedSettings && Date.now() < cacheExpiresAt) return cachedSettings;
  const settings = await Setting.findOneAndUpdate(
    { _id: DEFAULT_SETTINGS_ID },
    { $setOnInsert: { _id: DEFAULT_SETTINGS_ID } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  const familyMembership = settings.familyMembership || {};
  cachedSettings = {
    ...settings,
    gstEnabled: settings.gstEnabled ?? true,
    gstRate: settings.gstRate ?? 18,
    gstLabel: settings.gstLabel || 'GST',
    gstin: settings.gstin || '',
    familyMembership: {
      ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG,
      ...familyMembership,
      multipliers: {
        ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.multipliers,
        ...familyMembership.multipliers,
      },
      discounts: {
        ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.discounts,
        ...familyMembership.discounts,
      },
      limits: {
        ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.limits,
        ...familyMembership.limits,
      },
      reviewTargets: {
        ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.reviewTargets,
        ...familyMembership.reviewTargets,
      },
      tiers: familyMembership.tiers?.length
        ? familyMembership.tiers
        : DEFAULT_FAMILY_MEMBERSHIP_CONFIG.tiers,
    },
  };
  cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
  return cachedSettings;
}

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

export { DEFAULT_SETTINGS_ID };
export default Setting;
