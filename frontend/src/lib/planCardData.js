// Convert one API plan into the display values shared by both plan-card grids.
import { formatPoints, formatRupees } from './formatters.js';

// API plans store cohort points/labels under benefitsCohorts, benefits, or legacy cohorts.
export function mapPlanToCard(plan) {
  const sourceCohorts = plan.benefitsCohorts?.length
    ? plan.benefitsCohorts
    : plan.benefits?.length
      ? plan.benefits
      : plan.cohorts || [];

  return {
    ...plan,
    title: plan.benefitsTitle || plan.name || plan.title,
    subtitle: plan.subtitle || `${plan.termYears || 25} year membership`,
    priceLabel: plan.displayPrice || formatRupees(plan.price ?? plan.numericPrice),
    cohorts: sourceCohorts.map((cohort) => {
      const amount = cohort.points ?? cohort.amount;
      return {
        displayAmount: amount == null ? '' : formatPoints(amount),
        label: cohort.label || '',
      };
    }),
  };
}
