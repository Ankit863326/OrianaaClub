import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  FormField,
  LoadingState,
  Panel,
  Toast,
  controlClass,
} from '../../components/ui.jsx';
import { membershipApi } from '../../api/membership.js';
import { formatPointChannel, formatPts } from '../formatters.js';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';

const rowsPerPage = 20;
const ledgerTypes = [
  ['credit_joining', 'Joining points'],
  ['credit_renewal', 'Renewal points'],
  ['debit_redeem', 'Redemption'],
  ['refund', 'Refund'],
  ['expire', 'Expiry'],
  ['admin_adjust', 'Manual adjustment'],
];

function typeLabel(type) {
  return ledgerTypes.find(([value]) => value === type)?.[1] || String(type || 'Unknown').replaceAll('_', ' ');
}

function createdByLabel(value) {
  return ({ admin: 'Admin', system: 'System', billing: 'Billing machine' })[value] || value || '—';
}

function entryDate(entry) {
  return entry.createdAt ? new Date(entry.createdAt).toISOString().slice(0, 10) : '';
}

export default function PointsLedgerTab() {
  const { id } = useParams();
  const [membership, setMembership] = useState(null);
  const [entries, setEntries] = useState(null);
  const [filters, setFilters] = useState({ type: '', channel: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [adjustment, setAdjustment] = useState({ amount: '', direction: '+', reason: '' });
  const [formOpen, setFormOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [detail, firstPage] = await Promise.all([
        membershipApi.member(id),
        membershipApi.ledger(id, {
          page: 1,
          limit: 100,
          type: filters.type || undefined,
          channel: filters.channel || undefined,
        }),
      ]);
      const allEntries = [...firstPage.items];
      for (let start = 2; start <= firstPage.pages; start += 10) {
        const pageNumbers = Array.from(
          { length: Math.min(10, firstPage.pages - start + 1) },
          (_, offset) => start + offset,
        );
        const pageResults = await Promise.all(pageNumbers.map((ledgerPage) => (
          membershipApi.ledger(id, {
            page: ledgerPage,
            limit: 100,
            type: filters.type || undefined,
            channel: filters.channel || undefined,
          })
        )));
        pageResults.forEach((result) => allEntries.push(...result.items));
      }
      setMembership(detail.membership);
      setEntries(allEntries);
      if (!silent) setPage(1);
    } catch (failure) {
      if (!silent) setError(errorMessage(failure));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useAutoRefresh(() => load({ silent: true }));

  useEffect(() => {
    load();
  }, [id, filters.type, filters.channel]);

  const filteredEntries = useMemo(() => {
    if (!entries) return [];
    return entries.filter((entry) => {
      const date = entryDate(entry);
      return (!filters.channel || (entry.channel || 'billing_counter') === filters.channel)
        && (!filters.from || date >= filters.from)
        && (!filters.to || date <= filters.to);
    });
  }, [entries, filters.from, filters.to]);
  const pageCount = Math.ceil(filteredEntries.length / rowsPerPage);
  const displayedEntries = filteredEntries.slice((page - 1) * rowsPerPage, page * rowsPerPage);
  const balance = Number(membership?.pointsBalance || 0);

  async function adjustPoints(event) {
    event.preventDefault();
    const amount = Number(adjustment.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      setError('Enter a positive whole number of points.');
      return;
    }
    if (!adjustment.reason.trim()) {
      setError('A reason is required for a manual points adjustment.');
      return;
    }
    if (adjustment.direction === '-' && amount > balance) {
      setError(`Cannot deduct ${formatPts(amount)}; current balance is ${formatPts(balance)}.`);
      return;
    }
    setError('');
    setConfirmation(true);
  }

  async function confirmAdjustment() {
    setBusy(true);
    setError('');
    try {
      await membershipApi.adjustPoints(id, {
        amount: Number(adjustment.amount),
        direction: adjustment.direction,
        reason: adjustment.reason.trim(),
      });
      setConfirmation(false);
      setFormOpen(false);
      setAdjustment({ amount: '', direction: '+', reason: '' });
      setNotice('Points balance adjusted.');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function updateFilter(key, value) {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  if (loading && !entries) return <LoadingState />;
  if (!entries && error) {
    return <section className="grid gap-4">
      <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>
      <Button variant="secondary" onClick={load}>Retry</Button>
    </section>;
  }

  return <section className="grid gap-5">
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {loading && <p className="text-sm text-slate-500" role="status">Loading points ledger…</p>}
    <Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Points ledger</h2>
          <p className="mt-1 text-sm text-slate-500">Current balance: {formatPts(balance)}</p>
        </div>
        <Button onClick={() => setFormOpen((open) => !open)}>Manual adjust points</Button>
      </div>
      <div className="mb-5 grid gap-4 sm:grid-cols-4">
        <FormField label="Type">
          <select className={controlClass} value={filters.type} onChange={(event) => updateFilter('type', event.target.value)}>
            <option value="">All types</option>
            {ledgerTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </FormField>
        <FormField label="Channel">
          <select className={controlClass} value={filters.channel} onChange={(event) => updateFilter('channel', event.target.value)}>
            <option value="">All channels</option>
            <option value="admin_manual">Admin adjustment</option>
            <option value="billing_counter">Billing counter</option>
            <option value="app">App</option>
            <option value="card">Card</option>
          </select>
        </FormField>
        <FormField label="From date">
          <input className={controlClass} type="date" value={filters.from} onChange={(event) => updateFilter('from', event.target.value)} />
        </FormField>
        <FormField label="To date">
          <input className={controlClass} type="date" value={filters.to} onChange={(event) => updateFilter('to', event.target.value)} />
        </FormField>
      </div>
      {displayedEntries.length
        ? <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{['Type', 'Channel', 'Amount', 'Balance after', 'Note', 'By', 'Date'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedEntries.map((entry) => <tr key={entry._id}>
                <td className="px-4 py-3.5 text-slate-700">{typeLabel(entry.type)}</td>
                <td className="px-4 py-3.5 text-slate-700">{formatPointChannel(entry.channel)}</td>
                <td className="px-4 py-3.5"><Badge tone={entry.direction === '+' ? 'active' : 'debit'}>{entry.direction || '+'}{formatPts(entry.amount)}</Badge></td>
                <td className="px-4 py-3.5 text-slate-700">{formatPts(entry.balanceAfter)}</td>
                <td className="max-w-72 px-4 py-3.5 text-slate-700">{entry.note || entry.bookingId || entry.billId || '—'}</td>
                <td className="px-4 py-3.5 text-slate-700">{createdByLabel(entry.createdBy)}</td>
                <td className="px-4 py-3.5 text-slate-700">{entry.createdAt ? new Date(entry.createdAt).toLocaleString('en-IN') : '—'}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No ledger entries match these filters.</div>}
      {pageCount > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
        <span>{filteredEntries.length} entries</span>
        <div className="flex items-center gap-3">
          <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
          <span>Page {page} of {pageCount}</span>
          <Button variant="secondary" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>Next</Button>
        </div>
      </div>}
    </Panel>

    {formOpen && <Panel>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={adjustPoints}>
        <h3 className="font-display text-lg sm:col-span-2">Manual points adjustment</h3>
        <FormField label="Amount (points)">
          <input className={controlClass} type="number" min="1" step="1" required value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} />
        </FormField>
        <FormField label="Adjustment">
          <select className={controlClass} value={adjustment.direction} onChange={(event) => setAdjustment({ ...adjustment, direction: event.target.value })}>
            <option value="+">Add points</option>
            <option value="-">Deduct points</option>
          </select>
        </FormField>
        <FormField label="Reason" className="sm:col-span-2">
          <textarea className={controlClass} rows="3" maxLength="1000" required value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} />
        </FormField>
        {adjustment.direction === '-' && Number(adjustment.amount) > balance && <p className="text-sm text-red-700 sm:col-span-2">
          Deduction cannot exceed the current balance of {formatPts(balance)}.
        </p>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>Continue</Button>
          <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Panel>}

    {confirmation && <ConfirmDialog
      title="Confirm points adjustment?"
      onCancel={() => setConfirmation(false)}
      onConfirm={confirmAdjustment}
      confirmLabel="Adjust points"
      busy={busy}
    >
      {`${adjustment.direction === '+' ? 'Add' : 'Deduct'} ${formatPts(adjustment.amount)}? Reason: ${adjustment.reason}`}
    </ConfirmDialog>}
  </section>;
}
