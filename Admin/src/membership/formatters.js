export function formatINR(value) {
  return `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
}

export function formatPts(value) {
  return `${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(value) || 0)} pts`;
}

export function formatPointChannel(channel) {
  return ({
    admin_manual: 'Admin adjustment',
    billing_counter: 'Billing counter',
    app: 'App',
    card: 'Card',
  })[channel || 'billing_counter'] || 'Billing counter';
}

export function formatMemberCode(code) {
  const value = String(code || '').trim().toUpperCase();
  return /^OC-\d{12,}(?:-(?:S|C\d+|F|M|SF|SM))?$/.test(value) ? value : '—';
}

export function formatMembershipDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—';
}
