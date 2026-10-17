import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import api from '../api/client.js';
import {
  Button,
  FormField,
  LoadingState,
  PageHeading,
  Panel,
  StatCard,
  Toast,
  controlClass,
  formatDate,
} from '../components/ui.jsx';
import {
  formatINR,
  formatMemberCode,
  formatMembershipDate,
  formatPointChannel,
  formatPts,
} from './formatters.js';

const emptyFilters = { from: '', to: '' };
const pointChannels = ['admin_manual', 'billing_counter', 'app', 'card'];
const formatCount = (value) => new Intl.NumberFormat('en-IN').format(Number(value) || 0);

function ExpiringMembersTable({ title, data }) {
  return <Panel>
    <h2 className="mb-4 font-display text-xl">{title}</h2>
    {data.items.length
      ? <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[680px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Member code', 'Name', 'Points balance', 'Points expiry'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((member) => <tr key={member._id}>
              <td className="px-4 py-3.5 text-slate-700">{member.memberCode
                ? <Link className="font-semibold text-forest underline" to={`/membership/members/${encodeURIComponent(member._id)}`}>{formatMemberCode(member.memberCode)}</Link>
                : '—'}</td>
              <td className="px-4 py-3.5 text-slate-700">{member.memberName}</td>
              <td className="px-4 py-3.5 text-slate-700">{formatPts(member.pointsBalance)}</td>
              <td className="px-4 py-3.5 text-slate-700">{formatMembershipDate(member.pointsExpireAt)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No points are expiring in this period.</div>}
    <p className="mt-3 text-sm text-slate-500">{data.count} members · {formatPts(data.totalPoints)} expiring</p>
  </Panel>;
}

export default function MembershipReportsPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/admin/reports/membership', { params: nextFilters });
      setReport(response.data.data);
      setFilters(nextFilters);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(emptyFilters);
  }, []);

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Reports" description="Points, expiry, early-bird, payment, and cancellation summaries." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    <Panel className="mb-5">
      <form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => {
        event.preventDefault();
        load(filters);
      }}>
        <FormField label="From date">
          <input className={controlClass} type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        </FormField>
        <FormField label="To date">
          <input className={controlClass} type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        </FormField>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={loading}>Apply dates</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => {
            setFilters(emptyFilters);
            load(emptyFilters);
          }}>Clear</Button>
        </div>
      </form>
    </Panel>
    {!report && loading && <LoadingState />}
    {!report && error && <Button variant="secondary" onClick={() => load()}>Retry</Button>}
    {report && <>
      {loading && <p className="mb-4 text-sm text-slate-500" role="status">Updating report…</p>}
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Points issued" value={formatPts(report.points.issued)} detail="Joining, renewal, and admin adjustments" />
        <StatCard label="Points redeemed" value={formatPts(report.points.redeemed)} />
        <StatCard label="Points expired" value={formatPts(report.points.expired)} />
        <StatCard label="Early-bird slots used" value={`${formatCount(report.earlyBird.used)} of ${formatCount(report.earlyBird.limit)} used`} detail={`${formatCount(report.earlyBird.remaining)} remaining`} />
      </div>

      <Panel className="mb-5">
        <h2 className="mb-4 font-display text-xl">Points redeemed by channel</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[520px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{['Channel', 'Count', 'Total pts'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pointChannels.map((channel) => {
                const total = report.pointsRedeemedByChannel?.find((item) => item._id === channel);
                return <tr key={channel}>
                  <td className="px-4 py-3.5 text-slate-700">{formatPointChannel(channel)}</td>
                  <td className="px-4 py-3.5 text-slate-700">{formatCount(total?.count)}</td>
                  <td className="px-4 py-3.5 text-slate-700">{formatPts(total?.totalPoints)}</td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mb-5 grid gap-5 xl:grid-cols-2">
        <ExpiringMembersTable title="Points expiring in the next 30 days" data={report.expiring30} />
        <ExpiringMembersTable title="Points expiring in the next 90 days" data={report.expiring90} />
      </div>

      <Panel className="mb-5">
        <h2 className="mb-4 font-display text-xl">Payments by method</h2>
        {report.paymentsByMethod.length
          ? <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[520px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Method', 'Payments', 'Total amount'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {report.paymentsByMethod.map((payment) => <tr key={payment._id || 'unknown'}>
                  <td className="px-4 py-3.5 text-slate-700">{String(payment._id || 'unknown').replaceAll('_', ' ')}</td>
                  <td className="px-4 py-3.5 text-slate-700">{payment.count}</td>
                  <td className="px-4 py-3.5 text-slate-700">{formatINR(Number(payment.totalAmount || 0) / 100)}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
          : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No confirmed payments in this date range.</div>}
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-xl">Cancellations and refunds</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Cancellations" value={formatCount(report.cancellations.count)} />
          <StatCard label="Points refunded" value={formatPts(report.cancellations.refundedPoints)} />
        </div>
        <p className="mt-4 text-xs text-slate-500">Report generated {formatDate(report.generatedAt)}. Date filters apply to points, payments, and cancellation totals; expiry lists and the early-bird counter show current values.</p>
      </Panel>
    </>}
  </section>;
}
