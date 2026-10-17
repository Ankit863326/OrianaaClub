import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import { membershipApi } from '../api/membership.js';
import { Badge, DataTable, LoadingState, PageHeading, Pagination, Toast, controlClass, formatDate, formatPoints } from '../components/ui.jsx';

const initial = { search: '', tier: '', status: '', documentsPending: '', notActivated: '', page: 1, limit: 20 };

export default function MembershipMembersPage() {
  const [filters, setFilters] = useState(initial);
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setData(null);
    membershipApi.members(filters).then((result) => { if (active) { setData(result); setPlans(result.tiers || []); } })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [filters]);

  const columns = [
    { key: 'memberCode', label: 'Member code', render: (row) => row.formattedMemberCode || '—' },
    { key: 'name', label: 'Name', render: (row) => <Link className="font-semibold text-forest hover:underline" to={`/membership/members/${row._id}`}>{row.profile?.fullName || row.user?.firstName || '—'}</Link> },
    { key: 'tier', label: 'Tier', render: (row) => row.plan?.name || row.plan?.title || '—' },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'applicationState', label: 'Application', render: (row) => row.applicationState || '—' },
    { key: 'activationEmailStatus', label: 'Password link status', render: (row) => row.user?.status === 'active' || row.user?.activationEmailStatus === 'activated' ? 'Password set' : row.user?.activationEmailStatus || 'not_sent' },
    { key: 'pointsBalance', label: 'Points', render: (row) => `${formatPoints(row.pointsBalance)} pts` },
    { key: 'pointsExpireAt', label: 'Points expiry', render: (row) => formatDate(row.pointsExpireAt) },
    { key: 'membershipExpireAt', label: 'Membership expiry', render: (row) => formatDate(row.membershipExpireAt) },
  ];
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: 1 }));

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Members" description="Search by name, phone, member code or member number." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <input className={controlClass} aria-label="Search members" placeholder="Name, phone, member code or number" value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} />
      <select className={controlClass} aria-label="Filter membership tier" value={filters.tier} onChange={(event) => updateFilter('tier', event.target.value)}><option value="">All tiers</option>{plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</select>
      <select className={controlClass} aria-label="Filter membership status" value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}><option value="">All statuses</option>{['draft', 'pending_payment', 'pending_verification', 'active', 'expired', 'cancelled'].map((status) => <option key={status}>{status}</option>)}</select>
      <select className={controlClass} aria-label="Filter documents pending" value={filters.documentsPending} onChange={(event) => updateFilter('documentsPending', event.target.value)}><option value="">All document states</option><option value="true">Documents pending</option></select>
      <select className={controlClass} aria-label="Filter password status" value={filters.notActivated} onChange={(event) => updateFilter('notActivated', event.target.value)}><option value="">All password-link states</option><option value="true">Password not set</option></select>
    </div>
    {!data && !error && <LoadingState />}
    {data && <><DataTable columns={columns} rows={data.items} empty="No memberships match these filters." /><Pagination info={data} onPage={(page) => setFilters((current) => ({ ...current, page }))} /></>}
  </section>;
}
