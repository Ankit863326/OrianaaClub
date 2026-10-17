import mongoose from 'mongoose';

const DEFAULT_SETTINGS_ID = 'global';
const SETTINGS_CACHE_TTL_MS = 30_000;

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
  cachedSettings = {
    ...settings,
    gstEnabled: settings.gstEnabled ?? true,
    gstRate: settings.gstRate ?? 18,
    gstLabel: settings.gstLabel || 'GST',
    gstin: settings.gstin || '',
  };
  cacheExpiresAt = Date.now() + SETTINGS_CACHE_TTL_MS;
  return cachedSettings;
}

const Setting = mongoose.models.Setting || mongoose.model('Setting', settingSchema);

export { DEFAULT_SETTINGS_ID };
export default Setting;
