import mongoose from 'mongoose';
import MembershipPlan from '../models/MembershipPlan.js';
import Plan from '../models/Plan.js';
import User from '../models/User.js';

export async function hydrateMembershipReferences(memberships) {
  const memberIds = [...new Set(memberships
    .map((membership) => membership.user || membership.customer)
    .filter((id) => mongoose.isValidObjectId(id))
    .map(String))];
  const planReferences = [...new Map(memberships
    .filter((membership) => mongoose.isValidObjectId(membership.plan))
    .map((membership) => [
      `${membership.planModel || 'Plan'}:${membership.plan}`,
      { model: membership.planModel || 'Plan', id: String(membership.plan) },
    ])).values()];
  const [users, legacyPlans, membershipPlans] = await Promise.all([
    memberIds.length
      ? User.find({ _id: { $in: memberIds } })
        .select('firstName email status activationEmailStatus activationEmailSentAt').lean()
      : [],
    planReferences.some((reference) => reference.model === 'Plan')
      ? Plan.find({ _id: { $in: planReferences.filter((item) => item.model === 'Plan').map((item) => item.id) } })
        .select('name title price sortOrder slug').lean()
      : [],
    planReferences.some((reference) => reference.model === 'MembershipPlan')
      ? MembershipPlan.find({
        _id: { $in: planReferences.filter((item) => item.model === 'MembershipPlan').map((item) => item.id) },
      }).select('name price').lean()
      : [],
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const planByReference = new Map([
    ...legacyPlans.map((plan) => [`Plan:${plan._id}`, plan]),
    ...membershipPlans.map((plan) => [`MembershipPlan:${plan._id}`, plan]),
  ]);
  return memberships.map((membership) => {
    const userId = membership.user || membership.customer;
    const user = userById.get(String(userId)) || null;
    const plan = planByReference.get(`${membership.planModel || 'Plan'}:${membership.plan}`) || null;
    return {
      ...membership,
      user,
      plan,
      brokenReferences: [
        !user && 'member',
        !plan && 'plan',
      ].filter(Boolean),
    };
  });
}
