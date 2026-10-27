function normalizeTier(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getFamilyTier(plan, tiers = []) {
  const planKeys = [plan?.slug, plan?.id, plan?.name, plan?.title]
    .map(normalizeTier)
    .filter(Boolean);
  const matchedTier = tiers.find((tier) => planKeys.includes(normalizeTier(tier.tier)));
  return matchedTier || null;
}
