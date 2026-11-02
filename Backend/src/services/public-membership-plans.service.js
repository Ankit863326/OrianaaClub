// Share the active plan catalog shown on the public membership page.
import MembershipPlan from '../models/MembershipPlan.js';
import { getSettings } from '../models/Setting.js';
import { getFamilyTier } from './family-tier.service.js';

export async function listPublicMembershipPlans() {
  const [plans, settings] = await Promise.all([
    MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    getSettings(),
  ]);

  return plans.map((plan) => ({
    ...plan,
    slug: plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    title: plan.name,
    subtitle: `${settings.membershipValidityYears} year membership`,
    termYears: settings.membershipValidityYears,
    familyLimits: settings.familyMembership.limits,
    familyEnabled: getFamilyTier(plan, settings.familyMembership.tiers)?.familyEnabled ?? false,
    benefitsTitle: plan.name,
    benefits: [
      { points: plan.earlyBirdPoints, label: `First ${settings.earlyBirdLimit} members` },
      { points: plan.defaultPoints, label: 'Standard joining points' },
      { points: plan.renewalPoints, label: 'Renewal points' },
    ],
  }));
}
