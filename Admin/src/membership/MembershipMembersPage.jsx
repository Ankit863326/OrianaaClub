import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import {
  Button,
  FormField,
  LoadingState,
  PageHeading,
  Pagination,
  Panel,
  Toast,
  controlClass,
} from '../components/ui.jsx';
import MembershipStatusChip from './MembershipStatusChip.jsx';
import { membershipMembersApi } from './memberApi.js';
import { formatMemberCode } from './formatters.js';

const initialFilters = { search: '', tier: '', status: '', memberType: '', ratePhase: '', aadhaarPending: '' };

function relationshipLabel(member) {
  const formatted = member.primaryMemberNo ? formatMemberCode(member.primaryMemberNo) : '';
  const primary = formatted && formatted !== '—' ? formatted : 'primary member';
  switch (member.memberType) {
    case 'spouse': return `Spouse of ${primary}`;
    case 'child': return `Child of ${primary}`;
    case 'father': return `Father of ${primary}`;
    case 'mother': return `Mother of ${primary}`;
    case 'nominee_gm': return `GM nominee of ${primary}`;
    case 'nominee_hr': return `HR nominee of ${primary}`;
    case 'nominee': return `Nominee of ${primary}`;
    default: return 'Primary';
  }
}

export default function MembershipMembersPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextPage = page, nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      setData(await membershipMembersApi.list({
        ...nextFilters,
        page: nextPage,
        limit: 20,
      }));
      setPage(nextPage);
    } catch (failure) {
      setError(failure.response?.data?.message || errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, initialFilters);
  }, []);

  function openMember(id) {
    navigate(`/membership/members/${encodeURIComponent(id)}`);
  }

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Members" description="Search and manage membership records." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    <Panel className="mb-5">
      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6" onSubmit={(event) => {
        event.preventDefault();
        load(1);
      }}>
        <FormField label="Search name, phone, Member ID, sequence digits or legacy code" className="sm:col-span-2">
          <input
            className={controlClass}
            value={filters.search}
            onChange={(event) => setFilters({ ...filters, search: event.target.value })}
            placeholder="Search memberships"
          />
        </FormField>
        <FormField label="Tier">
          <select className={controlClass} value={filters.tier} onChange={(event) => setFilters({ ...filters, tier: event.target.value })}>
            <option value="">All tiers</option>
            {(data?.tiers || []).map((tier) => <option key={tier._id} value={tier._id}>{tier.name || tier.title}</option>)}
          </select>
        </FormField>
        <FormField label="Member type">
          <select className={controlClass} value={filters.memberType} onChange={(event) => setFilters({ ...filters, memberType: event.target.value })}>
            <option value="">All member types</option>
            {['primary', 'spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee'].map((type) => (
              <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Status">
          <select className={controlClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">All statuses</option>
            {['draft', 'profile_only', 'payment_pending', 'pending_payment', 'pending_verification', 'pending_approval', 'active', 'expired', 'cancelled'].map((status) => (
              <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>
            ))}
          </select>
        </FormField>
        <FormField label="Points rate">
          <select className={controlClass} value={filters.ratePhase} onChange={(event) => setFilters({ ...filters, ratePhase: event.target.value })}>
            <option value="">All rates</option>
            <option value="early_bird">Early bird</option>
            <option value="default">Default</option>
          </select>
        </FormField>
        <FormField label="Aadhaar">
          <select className={controlClass} value={filters.aadhaarPending} onChange={(event) => setFilters({ ...filters, aadhaarPending: event.target.value })}>
            <option value="">All Aadhaar statuses</option>
            <option value="true">Pending verification</option>
          </select>
        </FormField>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" disabled={loading}>Search</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => {
            setFilters(initialFilters);
            load(1, initialFilters);
          }}>Clear filters</Button>
        </div>
      </form>
    </Panel>
    {loading && !data && <LoadingState />}
    {error && !data && <Button variant="secondary" onClick={() => load(1)}>Retry</Button>}
    {data && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>{['Member ID', 'Name', 'Relationship', 'Tier', 'Status', 'Approval sequence', 'Points rate', 'Aadhaar status', 'Family tree'].map((label) => (
            <th key={label} className="px-4 py-3 font-semibold">{label}</th>
          ))}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.items.map((member) => {
            const name = member.profile?.fullName || member.user?.firstName || '—';
            const displayCode = member.memberCode;
            const code = displayCode ? formatMemberCode(displayCode) : '—';
            return <tr
              key={member._id}
              className="cursor-pointer hover:bg-slate-50/70 focus-within:bg-slate-50/70"
              tabIndex="0"
              onClick={() => openMember(member._id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openMember(member._id);
                }
              }}
            >
              <td className="px-4 py-3.5 text-slate-700">{code}</td>
              <td className="px-4 py-3.5 text-slate-700">{name}</td>
              <td className="px-4 py-3.5"><span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">{relationshipLabel(member)}</span></td>
              <td className="px-4 py-3.5 text-slate-700">{member.plan?.name || member.plan?.title || '—'}</td>
              <td className="px-4 py-3.5"><MembershipStatusChip status={member.status} /></td>
              <td className="px-4 py-3.5 text-slate-700">{member.approvalSeq ?? '—'}</td>
              <td className="px-4 py-3.5 text-slate-700">{String(member.memberType || '').startsWith('nominee')
                ? 'No points'
                : `${Number(member.pointsMultiplier || 0).toLocaleString('en-IN')}x ${member.ratePhase === 'early_bird' ? 'early bird' : 'default'}`}</td>
              <td className="px-4 py-3.5 capitalize text-slate-700">{String(member.aadhaarStatus || 'not_added').replaceAll('_', ' ')}</td>
              <td className="px-4 py-3.5">
                {member.memberCode
                  ? <Link
                    className="font-semibold text-forest underline"
                    to={`/membership/family-tree/${encodeURIComponent(member.memberCode)}`}
                    onClick={(event) => event.stopPropagation()}
                  >Open</Link>
                  : '—'}
              </td>
            </tr>;
          })}
          {!data.items.length && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="9">No memberships found.</td></tr>}
        </tbody>
      </table>
    </div>}
    {data && <Pagination
      info={{ page: data.page, pages: data.pages, total: data.total }}
      onPage={(nextPage) => load(nextPage)}
    />}
    {loading && data && <p className="mt-3 text-sm text-slate-500" role="status">Loading memberships…</p>}
  </section>;
}
