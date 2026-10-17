import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  LoadingState,
  Pagination,
  Panel,
  Toast,
} from '../../components/ui.jsx';
import { membershipApi } from '../../api/membership.js';
import { formatINR, formatPointChannel, formatPts } from '../formatters.js';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';

const pageSize = 20;

function statusChip(status) {
  const label = String(status || 'unknown').replaceAll('_', ' ');
  return <Badge tone={label}>{label}</Badge>;
}

export default function BillsBookingsTab() {
  const { id } = useParams();
  const [membership, setMembership] = useState(null);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState({ status: '', channel: '', from: '', to: '' });
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextPage = page, nextFilter = filter, memberCode = membership?.memberCode, { silent = false } = {}) {
    if (!memberCode) return;
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await membershipApi.bills({
        page: nextPage,
        limit: pageSize,
        memberCode,
        status: nextFilter.status || undefined,
        channel: nextFilter.channel || undefined,
        from: nextFilter.from || undefined,
        to: nextFilter.to || undefined,
      });
      setData(result);
      setPage(nextPage);
    } catch (failure) {
      if (!silent) setError(errorMessage(failure));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useAutoRefresh(() => load(page, filter, membership?.memberCode, { silent: true }), {
    enabled: Boolean(membership?.memberCode),
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    membershipApi.member(id)
      .then((detail) => {
        if (!active) return;
        setMembership(detail.membership);
        if (detail.membership.memberCode) {
          load(1, filter, detail.membership.memberCode);
        } else {
          setData({ items: [], page: 1, pages: 0, total: 0 });
          setLoading(false);
        }
      })
      .catch((failure) => {
        if (active) {
          setError(errorMessage(failure));
          setLoading(false);
        }
      });
    return () => { active = false; };
  }, [id]);

  async function cancelBill() {
    setBusy(true);
    setError('');
    try {
      await membershipApi.cancelBill(confirmation.bill._id);
      setNotice('Bill cancelled.');
      setConfirmation(null);
      await load(page);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const rows = data?.items || [];

  if (loading && !data) return <LoadingState />;
  if (!data && error) {
    return <section className="grid gap-4">
      <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>
      <Button variant="secondary" onClick={() => load(1)}>Retry</Button>
    </section>;
  }

  return <section className="grid gap-5">
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <Panel>
      <form className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" onSubmit={(event) => {
        event.preventDefault();
        load(1, filter);
      }}>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>Status</span>
          <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}>
            <option value="">All statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>Channel</span>
          <select className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" value={filter.channel} onChange={(event) => setFilter({ ...filter, channel: event.target.value })}>
            <option value="">All channels</option>
            <option value="billing_counter">Billing counter</option>
            <option value="app">App</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>From</span>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" type="date" value={filter.from} onChange={(event) => setFilter({ ...filter, from: event.target.value })} />
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-slate-700">
          <span>To</span>
          <input className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900" type="date" value={filter.to} onChange={(event) => setFilter({ ...filter, to: event.target.value })} />
        </label>
        <Button className="self-end" type="submit" disabled={loading}>Apply filters</Button>
      </form>
      <h2 className="mb-4 font-display text-xl">Bills & bookings</h2>
      {loading && <p className="mb-3 text-sm text-slate-500" role="status">Loading bills…</p>}
      {rows.length
        ? <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{['Date', 'Service', 'Booking / Bill ID', 'Channel', 'Bill amount', 'Discount', 'Points used', 'Balance after', 'Status', 'Refunded', ''].map((label) => <th key={label || 'action'} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((bill) => <tr key={bill._id}>
                <td className="px-3 py-3.5 text-slate-700">{bill.createdAt ? new Date(bill.createdAt).toLocaleDateString('en-IN') : '—'}</td>
                <td className="px-3 py-3.5 text-slate-700">{String(bill.serviceType || '—').replaceAll('_', ' ')}</td>
                <td className="px-3 py-3.5 text-slate-700">{bill.bookingId || bill.billId || '—'}{bill.bookingId && bill.billId ? <small className="block text-slate-500">{bill.billId}</small> : null}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPointChannel(bill.channel)}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatINR(bill.billAmount)}</td>
                <td className="px-3 py-3.5 text-slate-700">{bill.discountPercent ?? '—'}%</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPts(bill.pointsUsed)}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPts(bill.balanceAfter)}</td>
                <td className="px-3 py-3.5">{statusChip(bill.status)}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPts(bill.refundedPoints || 0)}</td>
                <td className="px-3 py-3.5">
                  {bill.status === 'confirmed' && <Button
                  variant="danger"
                  disabled={busy || new Date(bill.eventDate) < new Date()}
                  onClick={() => setConfirmation({ bill })}
                >Cancel bill</Button>}
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
          {membership?.memberCode ? 'No redemption bills found for this membership.' : 'This membership does not have a member code yet.'}
        </div>}
      {data && <Pagination
        info={{ page: data.page, pages: data.pages, total: data.total }}
        onPage={(nextPage) => load(nextPage)}
      />}
    </Panel>
    {confirmation && <ConfirmDialog
      title="Cancel bill?"
      onCancel={() => setConfirmation(null)}
      onConfirm={cancelBill}
      confirmLabel="Cancel bill"
      busy={busy}
    >
      <p>Cancel bill {confirmation.bill.billId}?</p>
    </ConfirmDialog>}
  </section>;
}
