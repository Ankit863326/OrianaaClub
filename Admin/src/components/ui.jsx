// These shared controls give every admin page the same simple, accessible building blocks.
import { useState } from 'react';
import { Eye, EyeOff, LoaderCircle, X } from 'lucide-react';

export const formatRupees = (rupees) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(rupees || 0));

export const formatPaise = (paise) => formatRupees(Number(paise || 0) / 100);
export const formatPoints = (points) => Number(points || 0).toLocaleString('en-IN');

export function Button({ children, variant = 'primary', className = '', ...props }) {
  const colors = {
    primary: 'bg-forest text-white hover:bg-forest/90',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    gold: 'bg-gold text-midnight hover:bg-gold/90',
  };
  return <button className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${colors[variant]} ${className}`} {...props}>{children}</button>;
}

export function FormField({ label, children, className = '' }) {
  return <label className={`grid gap-1.5 text-sm font-medium text-slate-700 ${className}`}><span>{label}</span>{children}</label>;
}

export const controlClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-forest focus:ring-2 focus:ring-forest/15';

export function PageHeading({ eyebrow, title, description, actions }) {
  return <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
    <div>{eyebrow && <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-gold">{eyebrow}</p>}
      <h1 className="font-display text-3xl text-slate-900 sm:text-4xl">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
  </div>;
}

export function Panel({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-soft sm:p-6 ${className}`}>{children}</section>;
}

export function StatCard({ label, value, detail, icon: Icon }) {
  return <Panel className="grid gap-3">
    <div className="flex items-center justify-between text-sm text-slate-500"><span>{label}</span>{Icon && <Icon size={19} className="text-gold" />}</div>
    <strong className="font-display text-2xl text-slate-900">{value}</strong>
    {detail && <small className="text-xs text-slate-500">{detail}</small>}
  </Panel>;
}

export function Badge({ children, tone }) {
  const normalized = String(tone || children || '').toLowerCase();
  const classes = normalized.includes('pending') || normalized.includes('new')
    ? 'bg-amber-100 text-amber-800'
    : normalized.includes('active') || normalized.includes('paid') || normalized.includes('sent') || normalized.includes('published')
      ? 'bg-emerald-100 text-emerald-800'
      : normalized.includes('suspend') || normalized.includes('failed') || normalized.includes('reject') || normalized.includes('closed')
        ? 'bg-red-100 text-red-700'
        : 'bg-slate-100 text-slate-700';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{children}</span>;
}

export function LoadingState() {
  return <div className="grid min-h-40 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-500" role="status"><LoaderCircle className="animate-spin" size={24} />Loading…</div>;
}

export function EmptyState({ children = 'There is nothing to show yet.' }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{children}</div>;
}

export function Toast({ kind = 'success', children, onDismiss }) {
  const color = kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800';
  return <div className={`mb-4 flex items-start justify-between gap-4 rounded-xl border px-4 py-3 text-sm ${color}`} role={kind === 'error' ? 'alert' : 'status'}>{children}{onDismiss && <button onClick={onDismiss} aria-label="Dismiss message"><X size={16} /></button>}</div>;
}

export function DataTable({ columns, rows = [], empty = 'No records found.' }) {
  if (!rows.length) return <EmptyState>{empty}</EmptyState>;
  return <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
    <table className="w-full min-w-[680px] border-collapse text-left text-sm">
      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{columns.map((column) => <th key={column.key} className="px-4 py-3 font-semibold">{column.label}</th>)}</tr></thead>
      <tbody className="divide-y divide-slate-100">{rows.map((row, index) => <tr key={row._id || row.id || index} className="hover:bg-slate-50/70">
        {columns.map((column) => <td key={column.key} className="px-4 py-3.5 text-slate-700">{column.render ? column.render(row) : (row[column.key] ?? '—')}</td>)}
      </tr>)}</tbody>
    </table>
  </div>;
}

export function Pagination({ info, onPage }) {
  if (!info?.pages || info.pages <= 1) return null;
  return <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
    <span>{info.total ?? 0} records</span>
    <div className="flex items-center gap-3">
      <Button variant="secondary" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>Previous</Button>
      <span>Page {info.page} of {info.pages}</span>
      <Button variant="secondary" disabled={info.page >= info.pages} onClick={() => onPage(info.page + 1)}>Next</Button>
    </div>
  </div>;
}

export function ConfirmDialog({ title, children, onCancel, onConfirm, confirmLabel = 'Confirm', busy = false }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/55 p-4" role="presentation">
    <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <h2 id="confirm-title" className="font-display text-2xl text-slate-900">{title}</h2>
      <div className="my-5 text-sm leading-6 text-slate-600">{children}</div>
      <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onCancel}>Cancel</Button><Button variant="danger" disabled={busy} onClick={onConfirm}>{busy ? 'Working…' : confirmLabel}</Button></div>
    </section>
  </div>;
}

export function PasswordField({ value, onChange, required = true, autoComplete = 'current-password' }) {
  const [visible, setVisible] = useState(false);
  return <span className="relative block">
    <input className={`${controlClass} pr-11`} type={visible ? 'text' : 'password'} value={value} onChange={onChange} required autoComplete={autoComplete} />
    <button className="absolute inset-y-0 right-3 text-slate-400" type="button" onClick={() => setVisible((shown) => !shown)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button>
  </span>;
}

export function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('en-IN') : '—';
}
