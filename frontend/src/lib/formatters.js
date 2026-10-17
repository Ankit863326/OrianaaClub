// Keep membership amounts and points consistently grouped for Indian users.
export function formatRupees(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

export function formatPoints(amount) {
  return Number(amount || 0).toLocaleString('en-IN');
}
