import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import {
  Badge,
  Button,
  FormField,
  LoadingState,
  PageHeading,
  Pagination,
  Panel,
  Toast,
  controlClass,
  formatDate,
} from '../components/ui.jsx';
import { downloadMembershipBills, membershipApi } from '../api/membership.js';
import { formatINR, formatMemberCode, formatPointChannel, formatPts } from './formatters.js';
import useAutoRefresh from '../hooks/useAutoRefresh.js';

const pageSize = 20;
const serviceTypes = ['lawn', 'banquet', 'villa', 'resort', 'shoot', 'birthday', 'reunion', 'other'];
const statuses = ['confirmed', 'cancelled'];
const emptyFilters = { from: '', to: '', serviceType: '', status: '', memberCode: '', channel: '' };

function billMembershipId(bill) {
  return String(bill.membership?._id || bill.membership || '');
}

function memberName(detail) {
  return detail?.profile?.fullName
    || detail?.profile?.name
    || detail?.membership?.user?.firstName
    || detail?.membership?.user?.email
    || '—';
}

export default function MembershipBillsPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load(nextPage = page, nextFilters = filters, { silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await membershipApi.bills({
        ...nextFilters,
        page: nextPage,
        limit: pageSize,
      });
      const membershipIds = [...new Set(result.items.map(billMembershipId).filter(Boolean))];
      const details = await Promise.all(membershipIds.map(async (id) => (
        [id, await membershipApi.member(id)]
      )));
      setData({
        ...result,
        items: result.items.map((bill) => ({
          ...bill,
          memberDetail: details.find(([id]) => id === billMembershipId(bill))?.[1],
        })),
      });
      setPage(nextPage);
    } catch (failure) {
      if (!silent) setError(errorMessage(failure));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useAutoRefresh(() => load(page, filters, { silent: true }));

  useEffect(() => {
    load(1, emptyFilters);
  }, []);

  async function exportCsv() {
    setExporting(true);
    setError('');
    setNotice('');
    try {
      await downloadMembershipBills(filters);
      setNotice('Filtered bills exported.');
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setExporting(false);
    }
  }

  function openMember(bill) {
    const id = billMembershipId(bill);
    if (id) navigate(`/membership/members/${encodeURIComponent(id)}`);
  }

  return <section>
    <PageHeading
      eyebrow="MEMBERSHIP"
      title="Bills"
      description="Search redemption records across all memberships."
      actions={<Button variant="secondary" disabled={exporting} onClick={exportCsv}>
        {exporting ? 'Exporting…' : 'Export CSV'}
      </Button>}
    />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <Panel className="mb-5">
      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => {
        event.preventDefault();
        load(1, filters);
      }}>
        <FormField label="From date">
          <input className={controlClass} type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        </FormField>
        <FormField label="To date">
          <input className={controlClass} type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        </FormField>
        <FormField label="Service type">
          <select className={controlClass} value={filters.serviceType} onChange={(event) => setFilters({ ...filters, serviceType: event.target.value })}>
            <option value="">All services</option>
            {serviceTypes.map((service) => <option key={service} value={service}>{service}</option>)}
          </select>
        </FormField>
        <FormField label="Status">
          <select className={controlClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </FormField>
        <FormField label="Member ID">
          <input className={controlClass} value={filters.memberCode} maxLength="60" onChange={(event) => setFilters({ ...filters, memberCode: event.target.value })} placeholder="OC-YYEE11NNNNNN" />
        </FormField>
        <FormField label="Channel">
          <select className={controlClass} value={filters.channel} onChange={(event) => setFilters({ ...filters, channel: event.target.value })}>
            <option value="">All channels</option>
            <option value="admin_manual">Admin adjustment</option>
            <option value="billing_counter">Billing counter</option>
            <option value="app">App</option>
            <option value="card">Card</option>
          </select>
        </FormField>
        <div className="flex gap-2 xl:col-span-6">
          <Button type="submit" disabled={loading}>Apply filters</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => {
            setFilters(emptyFilters);
            load(1, emptyFilters);
          }}>Clear filters</Button>
        </div>
      </form>
    </Panel>
    {!data && loading && <LoadingState />}
    {!data && error && <Button variant="secondary" onClick={() => load(1)}>Retry</Button>}
    {data && <>
      {loading && <p className="mb-3 text-sm text-slate-500" role="status">Loading bills…</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full min-w-[1500px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{[
              'Date', 'Member', 'Member ID', 'Service', 'Booking / bill ID',
              'Channel', 'Bill amount', 'Discount', 'Points used', 'Balance after', 'Status', 'Refunded points',
            ].map((label) => <th key={label} className="px-3 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((bill) => {
              const memberId = billMembershipId(bill);
              const displayCode = bill.displayMemberCode || bill.memberCode;
              const code = displayCode ? formatMemberCode(displayCode) : '—';
              return <tr
                key={bill._id}
                className={memberId ? 'cursor-pointer hover:bg-slate-50/70' : ''}
                tabIndex={memberId ? 0 : undefined}
                onClick={() => openMember(bill)}
                onKeyDown={(event) => {
                  if (memberId && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    openMember(bill);
                  }
                }}
              >
                <td className="px-3 py-3.5 text-slate-700">{formatDate(bill.createdAt)}</td>
                <td className="px-3 py-3.5 text-slate-700">{memberName(bill.memberDetail)}</td>
                <td className="px-3 py-3.5 text-slate-700">{code}</td>
                <td className="px-3 py-3.5 text-slate-700">{String(bill.serviceType || '—').replaceAll('_', ' ')}</td>
                <td className="px-3 py-3.5 text-slate-700">{bill.bookingId || bill.billId || '—'}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPointChannel(bill.channel)}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatINR(bill.billAmount)}</td>
                <td className="px-3 py-3.5 text-slate-700">{bill.discountPercent ?? '—'}%</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPts(bill.pointsUsed)}</td>
                <td className="px-3 py-3.5 text-slate-700">{formatPts(bill.balanceAfter)}</td>
                <td className="px-3 py-3.5"><Badge tone={bill.status}>{String(bill.status || 'unknown').replaceAll('_', ' ')}</Badge></td>
                <td className="px-3 py-3.5 text-slate-700">{formatPts(bill.refundedPoints || 0)}</td>
              </tr>;
            })}
            {!data.items.length && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="12">No bills match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination info={data} onPage={(nextPage) => load(nextPage)} />
    </>}
  </section>;
}
