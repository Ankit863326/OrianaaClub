// Phase 2: Apply membership cohort and points-tier rules for a member number.
import { buildMemberId } from '../utils/memberCode.js';

function parseMemberNumber(memberNumber) {
  const number = Number.parseInt(memberNumber, 10);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function getPointsTier(plan, memberNumber) {
  const number = parseMemberNumber(memberNumber);
  if (!number) return null;
  const tiers = plan?.pointsTiers || [];
  return tiers.find((tier) => (
    number >= tier.fromMember
    && tier.toMember != null
    && number <= tier.toMember
  )) || [...tiers].reverse().find((tier) => tier.toMember == null) || null;
}

export function getMembershipCohort(plan, memberNumber) {
  const tier = getPointsTier(plan, memberNumber);
  if (!tier) return null;
  return (plan?.cohorts || []).find((cohort) => cohort.label === tier.label) || null;
}

export function formatMemberId({ activatedAt, expiresAt, sequence, suffix = '' }) {
  return buildMemberId({ activatedAt, expiresAt, sequence, suffix });
}
