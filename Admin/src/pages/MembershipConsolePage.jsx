import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { downloadMembershipBills, membershipApi } from '../api/membership.js';
import { Badge, Button, DataTable, FormField, LoadingState, PageHeading, Pagination, Panel, StatCard, Toast, controlClass, formatDate, formatPoints, formatRupees } from '../components/ui.jsx';

const asItems = (value) => Array.isArray(value) ? value : value?.items || [];
const asPage = (value) => Array.isArray(value) ? null : value;
const statuses = ['confirmed', 'cancelled'];
const services = ['lawn', 'banquet', 'villa', 'resort', 'shoot', 'birthday', 'reunion', 'other'];
const blankFilters = { from: '', to: '', serviceType: '', status: '', memberCode: '', page: 1, limit: 20 };

export default function MembershipConsolePage({ section }) {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(blankFilters);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState(null);
  const [newKeyName, setNewKeyName] = useState('');
  const [revealedKey, setRevealedKey] = useState('');
  const [auditFilters, setAuditFilters] = useState({ entity: '', actor: '', from: '', to: '', page: 1, limit: 20 });
  const [queuePage, setQueuePage] = useState(1);

  async function load() {
    setError('');
    try {
      if (section === 'bills') setData(await membershipApi.bills(filters));
      else if (section === 'queue') setData(await membershipApi.queue({ page: queuePage, limit: 20 }));
      else if (section === 'settings') {
        const [settings, keys] = await Promise.all([membershipApi.settings(), membershipApi.apiKeys()]);
        setData({ settings, keys });
        setSettingsDraft({ ...settings });
      } else if (section === 'reports') setData(await membershipApi.reports());
      else if (section === 'audit') setData(await membershipApi.audit(auditFilters));
    } catch (failure) { setError(errorMessage(failure)); }
  }
  useEffect(() => { load(); }, [section, filters, auditFilters, queuePage]);

  function updateFilter(setter, filtersValue, key, value) {
    setter({ ...filtersValue, [key]: value, page: 1 });
  }
  async function act(task, successMessage) {
    setBusy(true);
    setError('');
    try { await task(); setNotice(successMessage); await load(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function saveSettings(event) {
    event.preventDefault();
    await act(async () => {
      const body = { ...settingsDraft };
      ['discountPercent', 'pointsValidityYears', 'membershipValidityYears', 'earlyBirdLimit'].forEach((key) => { body[key] = Number(body[key]); });
      await membershipApi.updateSettings(body);
    }, 'Membership settings saved.');
  }
  async function createKey(event) {
    event.preventDefault();
    await act(async () => {
      const result = await membershipApi.createApiKey(newKeyName.trim());
      setRevealedKey(result.key || '');
      setNewKeyName('');
    }, 'Billing API key created. Copy and store it now.');
  }
  async function decideFamilyRequest(id, approve) {
    if (!window.confirm(`${approve ? 'Approve' : 'Reject'} this family request?`)) return;
    await act(() => membershipApi.decideFamilyRequest(id, approve), `Family request ${approve ? 'approved' : 'rejected'}.`);
  }

  const title = {
    bills: 'Membership bills',
    queue: 'Pending queue',
    settings: 'Membership settings',
    reports: 'Membership reports',
    audit: 'Membership audit log',
  }[section];

  const billColumns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'memberCode', label: 'Member code', render: (row) => row.formattedMemberCode || row.memberCode },
    { key: 'serviceType', label: 'Service' },
    { key: 'billId', label: 'Bill ID' },
    { key: 'billAmount', label: 'Bill', render: (row) => formatRupees(row.billAmount) },
    { key: 'discountedAmount', label: 'Discounted', render: (row) => formatRupees(row.discountedAmount) },
    { key: 'pointsUsed', label: 'Points', render: (row) => `${formatPoints(row.pointsUsed)} pts` },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'cancel', label: '', render: (row) => row.status === 'confirmed' && <Button variant="danger" onClick={() => {
      if (window.confirm('Cancel this bill?')) {
        act(() => membershipApi.cancelBill(row._id), 'Bill cancelled.');
      }
    }}>Cancel bill</Button> },
  ];
  const keyColumns = [
    { key: 'name', label: 'Key name' },
    { key: 'createdAt', label: 'Created', render: (row) => formatDate(row.createdAt) },
    { key: 'lastUsedAt', label: 'Last used', render: (row) => formatDate(row.lastUsedAt) },
    { key: 'isActive', label: 'Status', render: (row) => <Badge>{row.isActive ? 'Active' : 'Revoked'}</Badge> },
    { key: 'action', label: '', render: (row) => row.isActive && <Button variant="danger" onClick={() => {
      if (window.confirm(`Revoke API key "${row.name}"?`)) act(() => membershipApi.revokeApiKey(row._id), 'API key revoked.');
    }}>Revoke</Button> },
  ];
  const auditColumns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'actor', label: 'Actor', render: (row) => row.actor?.email || row.actor?.name || row.actor || '—' },
    { key: 'action', label: 'Action' },
    { key: 'entityType', label: 'Entity' },
    { key: 'summary', label: 'Summary' },
    { key: 'reason', label: 'Reason' },
  ];
  const queueMemberships = data?.memberships || [];
  const queueFamily = data?.familyRequests || [];
  const queuePayments = data?.payments || [];
  const pendingPaymentsColumns = [
    { key: 'membership', label: 'Membership', render: (row) => row.membership?.memberCode || row.membership || '—' },
    { key: 'method', label: 'Method', render: (row) => row.method === 'rtgs' ? 'RTGS' : row.method },
    { key: 'totalAmount', label: 'Amount', render: (row) => formatRupees(Number(row.totalAmount || row.amount || 0) / (row.totalAmount ? 100 : 1)) },
    { key: 'reference', label: 'Reference' },
    { key: 'confirm', label: '', render: (row) => <Button onClick={() => {
      if (window.confirm('Confirm this payment? Confirm a cheque only after it has cleared.')) act(() => membershipApi.confirmPayment(row._id), 'Payment confirmed.');
    }}>Confirm</Button> },
  ];

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title={title} description="Membership operations, reporting and audit tools." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {!data && !error && <LoadingState />}

    {section === 'bills' && data && <>
      <Panel className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <FormField label="From"><input className={controlClass} type="date" value={filters.from} onChange={(event) => updateFilter(setFilters, filters, 'from', event.target.value)} /></FormField>
        <FormField label="To"><input className={controlClass} type="date" value={filters.to} onChange={(event) => updateFilter(setFilters, filters, 'to', event.target.value)} /></FormField>
        <FormField label="Service type"><select className={controlClass} value={filters.serviceType} onChange={(event) => updateFilter(setFilters, filters, 'serviceType', event.target.value)}><option value="">All services</option>{services.map((item) => <option key={item}>{item}</option>)}</select></FormField>
        <FormField label="Status"><select className={controlClass} value={filters.status} onChange={(event) => updateFilter(setFilters, filters, 'status', event.target.value)}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select></FormField>
        <FormField label="Member code"><input className={controlClass} value={filters.memberCode} onChange={(event) => updateFilter(setFilters, filters, 'memberCode', event.target.value)} /></FormField>
        <Button className="sm:col-span-2 xl:col-span-5" variant="secondary" onClick={() => downloadMembershipBills(filters).catch((failure) => setError(errorMessage(failure)))}>Export CSV</Button>
      </Panel>
      <DataTable columns={billColumns} rows={asItems(data)} empty="No bills match these filters." />
      <Pagination info={asPage(data)} onPage={(page) => setFilters({ ...filters, page })} />
    </>}

    {section === 'queue' && data && <div className="grid gap-5">
      <Panel><h2 className="mb-3 font-display text-xl">Pending verification and payments</h2><DataTable columns={[
        { key: 'member', label: 'Member', render: (row) => row.user?.firstName || row.user?.email || '—' },
        { key: 'memberCode', label: 'Member code', render: (row) => row.formattedMemberCode || row.memberCode || '—' },
        { key: 'plan', label: 'Tier', render: (row) => row.plan?.name || '—' },
        { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
        { key: 'price', label: 'Price', render: (row) => formatRupees(row.plan?.price) },
        { key: 'action', label: '', render: (row) => <div className="flex flex-wrap gap-2">
          {row.status === 'pending_verification' && <><Button onClick={() => act(() => membershipApi.approveVerification(row._id), 'Membership verification approved.')}>Approve</Button><Button variant="danger" onClick={() => { const reason = window.prompt('Enter a rejection reason'); if (reason?.trim()) act(() => membershipApi.rejectVerification(row._id, reason), 'Verification rejected.'); }}>Reject</Button></>}
          {row.status === 'pending_payment' && <Button variant="secondary" onClick={() => window.location.assign(`/membership/members/${row._id}`)}>Open payments</Button>}
        </div> },
      ]} rows={queueMemberships} empty="No memberships are waiting for action." /></Panel>
      <Panel><h2 className="mb-3 font-display text-xl">Pending payments</h2><DataTable columns={pendingPaymentsColumns} rows={queuePayments} empty="No payments are waiting for confirmation." /></Panel>
      <Panel><h2 className="mb-3 font-display text-xl">Pending family requests</h2><DataTable columns={[
        { key: 'name', label: 'Member', render: (row) => row.name || row.fullName || '—' },
        { key: 'pendingAction', label: 'Request' },
        { key: 'membership', label: 'Membership', render: (row) => row.membership?.memberCode || row.membership?.memberNumber || '—' },
        { key: 'action', label: '', render: (row) => <div className="flex gap-2"><Button onClick={() => decideFamilyRequest(row._id, true)}>Approve</Button><Button variant="danger" onClick={() => decideFamilyRequest(row._id, false)}>Reject</Button></div> },
      ]} rows={queueFamily} empty="No family requests are waiting for approval." /></Panel>
      <Pagination info={data.membershipPagination} onPage={setQueuePage} />
    </div>}

    {section === 'settings' && data && settingsDraft && <div className="grid gap-5">
      <Panel><form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" onSubmit={saveSettings}>
        <h2 className="font-display text-xl sm:col-span-2 xl:col-span-3">Membership rules</h2>
        {[
          ['Discount percent', 'discountPercent'], ['Points validity (years)', 'pointsValidityYears'],
          ['Membership validity (years)', 'membershipValidityYears'], ['Early-bird limit', 'earlyBirdLimit'],
        ].map(([label, key]) => <FormField key={key} label={label}><input className={controlClass} type="number" min="0" step="1" required value={settingsDraft[key]} onChange={(event) => setSettingsDraft({ ...settingsDraft, [key]: event.target.value })} /></FormField>)}
        <Button type="submit" disabled={busy}>Save settings</Button>
      </form></Panel>
      <Panel><form className="grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={createKey}>
        <h2 className="font-display text-xl sm:col-span-2">Billing API keys</h2>
        <FormField label="Key name"><input className={controlClass} required maxLength="100" value={newKeyName} onChange={(event) => setNewKeyName(event.target.value)} /></FormField>
        <Button type="submit" disabled={busy} className="self-end">Create key</Button>
      </form>
      {revealedKey && <div className="my-4 grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
        <strong>Copy this key now. It will not be displayed again.</strong>
        <code className="break-all">{revealedKey}</code>
        <Button variant="secondary" onClick={() => navigator.clipboard.writeText(revealedKey).then(() => setNotice('API key copied.')).catch((failure) => setError(errorMessage(failure)))}>Copy key</Button>
      </div>}
      <div className="mt-4"><DataTable columns={keyColumns} rows={asItems(data.keys)} empty="No billing API keys created." /></div>
      </Panel>
    </div>}

    {section === 'reports' && data && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Points issued" value={`${formatPoints(data.points.issued)} pts`} />
      <StatCard label="Points redeemed" value={`${formatPoints(data.points.redeemed)} pts`} />
      <StatCard label="Early-bird slots remaining" value={`${formatPoints(data.earlyBird.remaining)} / ${formatPoints(data.earlyBird.limit)}`} />
      <StatCard label="Refunded points" value={`${formatPoints(data.refunds.refundedPoints)} pts`} detail={`${data.refunds.count} cancelled bills`} />
      <Panel className="sm:col-span-2"><h2 className="mb-3 font-display text-xl">Points expiring within 30 days</h2><p>{data.expiring30.count} memberships · {formatPoints(data.expiring30.totalPoints)} pts</p></Panel>
      <Panel className="sm:col-span-2"><h2 className="mb-3 font-display text-xl">Points expiring within 90 days</h2><p>{data.expiring90.count} memberships · {formatPoints(data.expiring90.totalPoints)} pts</p></Panel>
      <Panel className="sm:col-span-2 xl:col-span-4"><h2 className="mb-3 font-display text-xl">Confirmed payments by method</h2><DataTable columns={[
        { key: '_id', label: 'Method' }, { key: 'count', label: 'Payments' },
        { key: 'totalAmount', label: 'Total', render: (row) => formatRupees(Number(row.totalAmount || 0) / 100) },
      ]} rows={data.paymentsByMethod} empty="No confirmed payments." /></Panel>
      <Panel className="sm:col-span-2 xl:col-span-4"><h2 className="mb-3 font-display text-xl">Points expiring soon</h2><DataTable columns={[
        { key: 'memberCode', label: 'Member code', render: (row) => row.formattedMemberCode || row.memberCode },
        { key: 'pointsBalance', label: 'Points', render: (row) => `${formatPoints(row.pointsBalance)} pts` },
        { key: 'pointsExpireAt', label: 'Expiry', render: (row) => formatDate(row.pointsExpireAt) },
      ]} rows={data.expiring90.items} empty="No points are expiring in the next 90 days." /></Panel>
    </div>}

    {section === 'audit' && data && <>
      <Panel className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FormField label="Entity"><input className={controlClass} value={auditFilters.entity} onChange={(event) => updateFilter(setAuditFilters, auditFilters, 'entity', event.target.value)} /></FormField>
        <FormField label="Actor"><input className={controlClass} value={auditFilters.actor} onChange={(event) => updateFilter(setAuditFilters, auditFilters, 'actor', event.target.value)} /></FormField>
        <FormField label="From"><input className={controlClass} type="date" value={auditFilters.from} onChange={(event) => updateFilter(setAuditFilters, auditFilters, 'from', event.target.value)} /></FormField>
        <FormField label="To"><input className={controlClass} type="date" value={auditFilters.to} onChange={(event) => updateFilter(setAuditFilters, auditFilters, 'to', event.target.value)} /></FormField>
      </Panel>
      <DataTable columns={auditColumns} rows={asItems(data)} empty="No audit events match these filters." />
      <Pagination info={asPage(data)} onPage={(page) => setAuditFilters({ ...auditFilters, page })} />
    </>}
  </section>;
}
