import mongoose from 'mongoose';

const identityDocumentSchema = new mongoose.Schema({
  id: { type: String, required: true },
  kind: { type: String, enum: ['pan_front', 'pan_back', 'second_front', 'second_back'], required: true },
  storageKey: { type: String, required: true },
  mimeType: { type: String, enum: ['image/jpeg', 'image/png', 'application/pdf'], required: true },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

const identityVerificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  panCiphertext: { type: String, required: true, select: false },
  panMask: { type: String, required: true },
  idType: { type: String, enum: ['aadhaar', 'driving_licence', 'passport'], required: true },
  idCiphertext: { type: String, default: '', select: false },
  idMask: { type: String, required: true },
  aadhaarLast4: { type: String, default: '', select: false },
  aadhaarHash: { type: String, default: '', select: false },
  status: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  rejectionReason: { type: String, default: '', trim: true, maxlength: 1000 },
  consentAt: { type: Date, required: true },
  documents: { type: [identityDocumentSchema], default: [] },
  verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectedAt: { type: Date, default: null },
}, { timestamps: true });

identityVerificationSchema.index(
  { idType: 1, aadhaarHash: 1 },
  { unique: true, partialFilterExpression: { idType: 'aadhaar', aadhaarHash: { $type: 'string', $gt: '' } } },
);

const IdentityVerification = mongoose.models.IdentityVerification
  || mongoose.model('IdentityVerification', identityVerificationSchema);

export default IdentityVerification;
