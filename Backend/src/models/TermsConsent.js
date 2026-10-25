import mongoose from 'mongoose';

const termsConsentSchema = new mongoose.Schema({
  application_id: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, default: null, immutable: true },
  terms_version: { type: String, required: true, immutable: true },
  language: { type: String, required: true, immutable: true },
  document_sha256: { type: String, required: true, match: /^[a-f\d]{64}$/i, immutable: true },
  accepted_at: { type: Date, required: true, immutable: true },
  ip_address: { type: String, required: true, immutable: true },
  user_agent: { type: String, required: true, immutable: true },
  read_to_end: { type: Boolean, required: true, immutable: true },
  scroll_completed_at: { type: Date, default: null, immutable: true },
}, {
  collection: 'terms_consents',
  timestamps: false,
  strict: 'throw',
});

termsConsentSchema.index(
  { application_id: 1, terms_version: 1 },
  { name: 'terms_consents_application_version' },
);
termsConsentSchema.index(
  { application_id: 1, terms_version: 1, language: 1 },
  { name: 'terms_consents_application_version_language_unique', unique: true },
);

const immutableOperation = function rejectMutation(next) {
  next(new Error('Terms consent records are append-only.'));
};
termsConsentSchema.pre([
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
], immutableOperation);
termsConsentSchema.pre('deleteOne', { document: true, query: false }, immutableOperation);

const TermsConsent = mongoose.models.TermsConsent
  || mongoose.model('TermsConsent', termsConsentSchema, 'terms_consents');

export default TermsConsent;
