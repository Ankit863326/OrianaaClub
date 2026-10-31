import MemberReview from '../models/MemberReview.js';
import Membership from '../models/Membership.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';

const paidMembershipStatuses = ['pending_approval', 'active', 'expired'];

async function eligibleMembership(userId) {
  return Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
    $or: [
      { paymentConfirmedAt: { $ne: null } },
      { status: { $in: paidMembershipStatuses } },
    ],
  }).sort({ updatedAt: -1 });
}

export async function getMine(userId) {
  const membership = await eligibleMembership(userId);
  if (!membership) return { eligible: false, review: null };
  const review = await MemberReview.findOne({ user: userId }).select('rating message createdAt updatedAt').lean();
  return { eligible: true, review };
}

export async function saveMine(userId, values) {
  const membership = await eligibleMembership(userId);
  if (!membership) throw new ApiError(403, 'A confirmed membership payment is required to submit a review.');

  const [profile, user] = await Promise.all([
    Profile.findOne({ user: userId }).select('fullName').lean(),
    User.findById(userId).select('firstName').lean(),
  ]);
  const memberName = profile?.fullName || user?.firstName;
  if (!memberName) throw new ApiError(400, 'Complete your member profile before submitting a review.');

  const review = await MemberReview.findOneAndUpdate(
    { user: userId },
    { $set: { membership: membership._id, memberName, ...values } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  ).select('rating message createdAt updatedAt').lean();

  return review;
}

export async function listPublic() {
  const reviews = await MemberReview.find({})
    .select('memberName rating message createdAt')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return reviews;
}

export async function listAdmin(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    MemberReview.find({}).select('memberName rating message createdAt updatedAt')
      .sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    MemberReview.countDocuments({}),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function deleteAdmin(reviewId) {
  const review = await MemberReview.findByIdAndDelete(reviewId).select('memberName rating');
  if (!review) throw new ApiError(404, 'Member review was not found.');
  return review;
}
