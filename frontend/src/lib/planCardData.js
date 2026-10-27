// Convert one API plan into the display values shared by both plan-card grids.
import { formatPoints, formatRupees } from './formatters.js';

// Prefer canonical pointsTiers, while retaining the API's older benefit shapes.
export function mapPlanToCard(plan) {
  const sourceCohorts = [
    plan?.pointsTiers,
    plan?.benefitsCohorts,
    plan?.benefits,
    plan?.cohorts,
  ].find((tiers) => Array.isArray(tiers) && tiers.length > 0) ?? [];

  return {
    ...plan,
    title: plan?.benefitsTitle || plan?.name || plan?.title || 'Membership plan',
    subtitle: plan?.subtitle || `${plan?.termYears || 25} year membership`,
    priceLabel: formatRupees(plan?.price ?? plan?.numericPrice),
    cohorts: sourceCohorts.map((cohort) => {
      const tier = cohort ?? {};
      const amount = tier.points ?? tier.amount;
      const label = tier.label || (
        tier.fromMember == null
          ? ''
          : `Members ${formatPoints(tier.fromMember)}${tier.toMember == null
            ? ' onwards'
            : `–${formatPoints(tier.toMember)}`}`
      );
      return {
        displayAmount: amount == null ? '' : formatPoints(amount),
        label,
      };
    }),
  };
}
