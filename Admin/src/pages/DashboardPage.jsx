// This overview page summarizes membership, revenue, pending payments, and points.
import { useEffect, useState } from 'react';
import { CreditCard, Gem, Users, Wallet } from 'lucide-react';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { EmptyState, LoadingState, PageHeading, Panel, StatCard, Toast, formatRupees, formatPoints } from '../components/ui.jsx';

function LineChart({ values = [], title }) {
  const max = Math.max(1, ...values.map((item) => item.count || 0));
  const points = values.map((item, index) => `${values.length < 2 ? 0 : index * 100 / (values.length - 1)},${38 - (item.count || 0) * 32 / max}`).join(' ');
  return <Panel><h2 className="mb-4 font-semibold text-slate-800">{title}</h2>{values.length ? <><svg viewBox="0 0 100 42" className="h-40 w-full" role="img" aria-label={title}><polyline points={points} fill="none" stroke="#D4A017" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /></svg><div className="flex justify-between text-xs text-slate-400"><span>{values[0]?.date || '—'}</span><span>{values.at(-1)?.date || '—'}</span></div></> : <EmptyState>No recent signups.</EmptyState>}</Panel>;
}

function BarChart({ values = [], title }) {
  const max = Math.max(1, ...values.map((item) => item.totalAmount || item.count || 0));
  return <Panel><h2 className="mb-4 font-semibold text-slate-800">{title}</h2>{values.length ? <div className="flex h-48 items-end gap-2 overflow-x-auto">
    {values.map((item) => {
      const value = item.totalAmount ?? item.count ?? 0;
      return <div className="flex h-full min-w-8 flex-1 flex-col items-center justify-end gap-2" key={item.month || item.plan || item._id} title={`${item.month || item.plan || item._id}: ${value}`}>
        <i className="w-5 rounded-t-md bg-gradient-to-t from-forest to-gold" style={{ height: `${Math.max(4, value * 100 / max)}%` }} />
        <span className="text-[10px] text-slate-500">{item.month?.slice(5) || item.plan || item._id}</span>
      </div>;
    })}
  </div> : <EmptyState>No chart data yet.</EmptyState>}</Panel>;
}

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    adminApi.dashboard().then((result) => {
      if (active) setData(result);
    })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, []);
  if (!data && !error) return <LoadingState />;
  return <section>
    <PageHeading eyebrow="OVERVIEW" title="Dashboard" description="A live snapshot of the OrianaaClub membership and operations." />
    {error && <Toast kind="error">{error}</Toast>}
    {data && <>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total members" value={formatPoints(data.members.total)} detail={`${formatPoints(data.members.byStatus.active || 0)} active`} icon={Users} />
        <StatCard label="Paid revenue" value={formatRupees(data.revenue.totalAmount / 100)} detail={`${formatPoints(data.revenue.paidPayments)} payments`} icon={Gem} />
        <StatCard label="Pending transfers" value={formatPoints(data.pendingBankTransfers)} detail="Awaiting review" icon={CreditCard} />
        <StatCard label="Points issued / spent" value={`${formatPoints(data.points.issued)} / ${formatPoints(data.points.spent)}`} icon={Wallet} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <LineChart values={data.members.signupsLast30Days} title="New signups · last 30 days" />
        <BarChart values={data.revenue.monthly} title="Paid revenue · last 12 months (paise)" />
        <BarChart values={data.planCounts.map((item) => ({ ...item, plan: item.plan || 'Unassigned' }))} title="Members by plan" />
      </div>
    </>}
  </section>;
}
