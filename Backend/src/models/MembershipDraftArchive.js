import mongoose from 'mongoose';

const membershipDraftArchiveSchema = new mongoose.Schema({
  draftId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', default: null },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, collection: 'membershipdraftarchives' });

const MembershipDraftArchive = mongoose.models.MembershipDraftArchive
  || mongoose.model('MembershipDraftArchive', membershipDraftArchiveSchema);

export default MembershipDraftArchive;
