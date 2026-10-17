// This page searches members, filters the list, exports CSV, and creates new member accounts.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi, downloadCsv } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { membershipApi } from '../api/membership.js';
import { Badge, Button, DataTable, FormField, LoadingState, PageHeading, Pagination, Panel, Toast, controlClass, formatDate, formatPoints, formatRupees } from '../components/ui.jsx';
import { formatMemberCode } from '../membership/formatters.js';
import { membershipSettingsApi } from '../membership/settingsApi.js';

const blankProfile = { fullName: '', gender: 'prefer_not_to_say', countryCode: '+91', mobile: '', dob: '', interestArea: '', agreePromo: false };
const blankForm = () => ({ user: { firstName: '', email: '' }, profile: { ...blankProfile }, planSlug: '' });

export default function MembersPage() {
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', status: '', plan: '', notActivated: '' });
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [gstSettings, setGstSettings] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [offline, setOffline] = useState(false);
  const [offlineMethod, setOfflineMethod] = useState('bank_transfer');
  const [offlineReference, setOfflineReference] = useState('');
  const [offlinePaymentDate, setOfflinePaymentDate] = useState('');
  const [offlineAmount, setOfflineAmount] = useState('');
  const [offlineNote, setOfflineNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    adminApi.members(filters).then((result) => { if (active) setData(result); })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [filters]);
  useEffect(() => {
    let active = true;
    adminApi.plans({ limit: 100 }).then((result) => { if (active) setPlans(result.items || []); })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    membershipApi.plans().then((result) => { if (active) setMembershipPlans(result.items || []); })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    membershipSettingsApi.getSettings().then((settings) => {
      if (active) setGstSettings({
        enabled: settings.gstEnabled,
        rate: settings.gstRate,
        label: settings.gstLabel,
      });
    }).catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, []);

  async function createMember(event) {
    event.preventDefault();
    setError('');
    try {
      const body = { ...form, profile: { ...form.profile, dob: new Date(form.profile.dob).toISOString() } };
      if (offline) {
        body.offlinePayment = {
          method: offlineMethod,
          reference: offlineReference,
          paymentDate: offlinePaymentDate || undefined,
          amountPaise: Math.round(Number(offlineAmount) * 100),
          note: offlineNote,
        };
      }
      const result = await adminApi.createMember(body);
      setNotice(result.message || 'Member created. Send a password link from the member record when ready.');
      setForm(blankForm());
      setCreating(false);
      setFilters({ ...filters });
    } catch (failure) { setError(errorMessage(failure)); }
  }
    const selectedPlan = plans.find((plan) => plan.slug === form.planSlug);
    const gstAmount = selectedPlan && gstSettings?.enabled
      ? Math.round(Number(selectedPlan.price) * Number(gstSettings.rate)) / 100
      : 0;
    const totalAmount = selectedPlan ? Number(selectedPlan.price) + gstAmount : 0;
    const columns = [
    { key: 'name', label: 'Name', render: (row) => <Link className="font-semibold text-forest hover:underline" to={`/members/${row._id}`}>{row.profile?.fullName || row.firstName}</Link> },
    { key: 'email', label: 'Email' },
    { key: 'status', label: 'Status', render: (row) => <Badge>
      {row.status === 'active' ? 'Active'
        : row.membership?.status === 'draft' ? 'Draft'
          : row.membership?.status === 'pending_payment' ? 'Payment pending'
            : row.membership?.status === 'active' || row.membership?.status === 'pending_verification' ? 'Paid'
              : 'Password not set'}
    </Badge> },
    { key: 'memberId', label: 'Member ID', render: (row) => row.membership
      ? (row.membership.displayMemberCode ? formatMemberCode(row.membership.displayMemberCode) : '—')
      : 'No membership' },
    { key: 'plan', label: 'Plan', render: (row) => row.membership?.plan?.name || row.membership?.plan?.title || '—' },
    { key: 'pointsBalance', label: 'Points balance', render: (row) => row.membership ? formatPoints(row.membership.pointsBalance) : '—' },
    { key: 'pointsExpireAt', label: 'Points expiry', render: (row) => row.membership ? formatDate(row.membership.pointsExpireAt) : '—' },
  ];
  return <section>
    <PageHeading eyebrow="MEMBER DIRECTORY" title="Members" actions={<>
      <Button variant="secondary" onClick={() => downloadCsv('/admin/members/export', filters).catch((failure) => setError(errorMessage(failure)))}>Export CSV</Button>
      <Button onClick={() => setCreating((current) => !current)}>{creating ? 'Close form' : 'Add member'}</Button>
    </>} />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {creating && <Panel className="mb-5"><form className="grid gap-4 sm:grid-cols-2" onSubmit={createMember}>
      <h2 className="font-display text-xl sm:col-span-2">New member</h2>
      <FormField label="First name"><input className={controlClass} required value={form.user.firstName} onChange={(event) => setForm({ ...form, user: { ...form.user, firstName: event.target.value } })} /></FormField>
      <FormField label="Email"><input className={controlClass} type="email" required value={form.user.email} onChange={(event) => setForm({ ...form, user: { ...form.user, email: event.target.value } })} /></FormField>
      <FormField label="Full name"><input className={controlClass} required value={form.profile.fullName} onChange={(event) => setForm({ ...form, profile: { ...form.profile, fullName: event.target.value } })} /></FormField>
      <FormField label="Gender"><select className={controlClass} value={form.profile.gender} onChange={(event) => setForm({ ...form, profile: { ...form.profile, gender: event.target.value } })}><option value="prefer_not_to_say">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></FormField>
      <FormField label="Country code"><input className={controlClass} required value={form.profile.countryCode} onChange={(event) => setForm({ ...form, profile: { ...form.profile, countryCode: event.target.value } })} /></FormField>
      <FormField label="Mobile"><input className={controlClass} required value={form.profile.mobile} onChange={(event) => setForm({ ...form, profile: { ...form.profile, mobile: event.target.value } })} /></FormField>
      <FormField label="Date of birth"><input className={controlClass} type="date" required value={form.profile.dob} onChange={(event) => setForm({ ...form, profile: { ...form.profile, dob: event.target.value } })} /></FormField>
      <FormField label="Interest area"><input className={controlClass} required value={form.profile.interestArea} onChange={(event) => setForm({ ...form, profile: { ...form.profile, interestArea: event.target.value } })} /></FormField>
      <FormField label="Plan"><select className={controlClass} required value={form.planSlug} onChange={(event) => setForm({ ...form, planSlug: event.target.value })}><option value="">Choose plan</option>{plans.map((plan) => <option key={plan._id} value={plan.slug}>{plan.title}</option>)}</select></FormField>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.profile.agreePromo} onChange={(event) => setForm({ ...form, profile: { ...form.profile, agreePromo: event.target.checked } })} />Allows promotional updates</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offline} onChange={(event) => setOffline(event.target.checked)} />Record offline payment</label>
      {offline && <><FormField label="Payment method"><select className={controlClass} value={offlineMethod} onChange={(event) => setOfflineMethod(event.target.value)}><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="rtgs">RTGS</option></select></FormField><FormField label={offlineMethod === 'cheque' ? 'Cheque number' : offlineMethod === 'rtgs' ? 'RTGS UTR' : 'Bank reference'}><input className={controlClass} required value={offlineReference} onChange={(event) => setOfflineReference(event.target.value)} /></FormField><FormField label="Payment date"><input className={controlClass} type="date" required={offlineMethod === 'rtgs'} value={offlinePaymentDate} onChange={(event) => setOfflinePaymentDate(event.target.value)} /></FormField><FormField label="Amount received (INR)"><input className={controlClass} type="number" min="0.01" step="0.01" required value={offlineAmount} onChange={(event) => setOfflineAmount(event.target.value)} /></FormField><FormField label="Payment note"><input className={controlClass} required value={offlineNote} onChange={(event) => setOfflineNote(event.target.value)} /></FormField>
        {selectedPlan && gstSettings && <p className="text-sm text-slate-600 sm:col-span-2">
          Plan fee: {formatRupees(selectedPlan.price)}
          {gstSettings.enabled && ` · ${gstSettings.label} (${gstSettings.rate}%): ${formatRupees(gstAmount)}`}
          {` · Total to record: ${formatRupees(totalAmount)}`}
        </p>}
        {selectedPlan && !gstSettings && <p className="text-sm text-red-700 sm:col-span-2" role="alert">GST settings are still loading. Try again before recording payment.</p>}
      </>}
      <Button type="submit" disabled={offline && !gstSettings} className="sm:col-span-2 sm:justify-self-start">Create member</Button>
    </form></Panel>}
    <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(220px,1fr)_180px_180px_180px_auto]">
      <input className={controlClass} aria-label="Search members" placeholder="Search name, email, 12-digit member ID or phone" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} />
      <select className={controlClass} aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}><option value="">All statuses</option><option value="draft">Draft</option><option value="pending_payment">Pending payment</option><option value="pending_verification">Pending verification</option><option value="active">Active</option><option value="expired">Expired</option><option value="cancelled">Cancelled</option></select>
      <select className={controlClass} aria-label="Filter by plan" value={filters.plan} onChange={(event) => setFilters({ ...filters, plan: event.target.value, page: 1 })}><option value="">All plans</option>{membershipPlans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name}</option>)}</select>
      <select className={controlClass} aria-label="Filter password status" value={filters.notActivated} onChange={(event) => setFilters({ ...filters, notActivated: event.target.value, page: 1 })}><option value="">All password-link states</option><option value="true">Password not set</option></select>
      <Button variant="secondary" onClick={() => setFilters({ ...filters })}>Refresh</Button>
    </div>
    {!data && !error && <LoadingState />}
    {data && <><DataTable columns={columns} rows={data.items} empty="No members match these filters." /><Pagination info={data} onPage={(page) => setFilters({ ...filters, page })} /></>}
  </section>;
}
