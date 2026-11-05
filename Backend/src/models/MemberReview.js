import mongoose from 'mongoose';

const memberReviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  membership: { type: mongoose.Schema.Types.ObjectId, ref: 'Membership', required: true },
  memberName: { type: String, required: true, trim: true, maxlength: 120 },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  message: { type: String, required: true, trim: true, minlength: 10, maxlength: 1200 },
}, { timestamps: true });

memberReviewSchema.index({ createdAt: -1 });

const MemberReview = mongoose.models.MemberReview || mongoose.model('MemberReview', memberReviewSchema);

export default MemberReview;
