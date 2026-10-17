// Phase 2: Load active membership plans from the backend catalog.
import apiClient from './apiClient.js';
import { formatPoints, formatRupees } from './formatters.js';

export async function getPlans() {
  const result = await apiClient.get('/membership/plans');
  return (result?.data || []).map((plan) => {
    const benefits = (plan.benefits || plan.cohorts || []).map((benefit) => ({
      ...benefit,
      points: Number(benefit.points ?? benefit.amount ?? 0),
      displayPoints: formatPoints(benefit.points ?? benefit.amount),
    }));
    return {
      ...plan,
      id: plan._id,
      title: plan.name || plan.title,
      benefits,
      priceLabel: formatRupees(plan.price),
    };
  });
}
