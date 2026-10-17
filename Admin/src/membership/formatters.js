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
  const normalized = String(code || '').replace(/^OC-/i, '').replace(/[\s-]/g, '').toUpperCase();
  if (/^2651\d{8}$/.test(normalized)) return `${normalized.slice(0, 4)} ${normalized.slice(4)}`;
  if (normalized.length === 8) return `OC-${normalized.slice(0, 4)}-${normalized.slice(4)}`;
  if (normalized.length === 10) return `OC-${normalized.slice(0, 5)}-${normalized.slice(5)}`;
  return String(code || '');
}

export function formatMembershipDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—';
}
