// This page shows member profile, membership, family, payment, and points information.
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { Badge, Button, ConfirmDialog, DataTable, FormField, LoadingState, PageHeading, Panel, Toast, controlClass, formatDate, formatPaise, formatPoints } from '../components/ui.jsx';
import { formatMemberCode } from '../membership/formatters.js';

const tabs = ['Profile', 'Membership', 'Family', 'Payments', 'Points'];

export default function MemberDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Profile');
  const [confirm, setConfirm] = useState('');
  const [familyEdit, setFamilyEdit] = useState(null);
  const [familyDelete, setFamilyDelete] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try { setData(await adminApi.member(userId)); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  useEffect(() => { load(); }, [userId]);
  async function act(action) {
    try {
      if (action === 'delete') {
        await adminApi.deleteMember(userId);
        navigate('/members', { replace: true });
        return;
      }
      await adminApi.memberAction(userId, action);
      setNotice(action === 'resend-activation' ? 'Password setup link sent.' : `Member ${action}d.`);
      await load();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setConfirm(''); }
  }
  async function saveProfile(event) {
    event.preventDefault();
    const body = Object.fromEntries([...new FormData(event.currentTarget).entries()].filter(([, value]) => String(value).trim()));
    try { await adminApi.updateMember(userId, body); setNotice('Profile saved.'); await load(); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  async function saveFamily(event) {
    event.preventDefault();
    const body = Object.fromEntries([...new FormData(event.currentTarget).entries()].filter(([, value]) => String(value).trim()));
    try { await adminApi.updateFamily(userId, familyEdit._id, body); setFamilyEdit(null); setNotice('Family member updated.'); await load(); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  async function removeFamily() {
    try { await adminApi.deleteFamily(userId, familyDelete); setNotice('Family member removed.'); await load(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { setFamilyDelete(''); }
  }
  if (!data && !error) return <LoadingState />;
  if (!data) return <Toast kind="error">{error}</Toast>;
  const paymentColumns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'method', label: 'Method' }, { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'totalAmount', label: 'Total', render: (row) => formatPaise(row.totalAmount) }, { key: 'invoiceNumber', label: 'Invoice' },
  ];
  const familyColumns = [
    { key: 'fullName', label: 'Name' }, { key: 'relationship', label: 'Relationship' }, { key: 'gender', label: 'Gender' },
    { key: 'dob', label: 'Date of birth', render: (row) => formatDate(row.dob) },
    { key: 'actions', label: '', render: (row) => <div className="flex gap-2"><Button variant="secondary" onClick={() => setFamilyEdit(row)}>Edit</Button><Button variant="danger" onClick={() => setFamilyDelete(row._id)}>Delete</Button></div> },
  ];
  return <section>
    <PageHeading eyebrow="MEMBER RECORD" title={data.profile?.fullName || data.user.firstName} description={`${data.user.email} · ${data.user.status}`} actions={<>
      {data.user.status === 'active' ? <Button variant="secondary" onClick={() => setConfirm('suspend')}>Suspend</Button> : <Button onClick={() => setConfirm('activate')}>Mark active</Button>}
      {data.user.status === 'pending' && <Button variant="secondary" onClick={() => act('resend-activation')}>Resend password link</Button>}
      <Button variant="danger" onClick={() => setConfirm('delete')}>Delete</Button>
    </>} />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}{notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <Panel className="mb-4 grid gap-2 text-sm sm:grid-cols-2">
      <p>Application state: <Badge>{data.user.status === 'active' ? 'Active' : data.membership?.status === 'draft' ? 'Draft' : data.membership?.status === 'pending_payment' ? 'Payment pending' : ['active', 'pending_verification'].includes(data.membership?.status) ? 'Paid' : 'Password not set'}</Badge></p>
      <p>Password link status: <strong>{data.user.status === 'active' || data.user.activationEmailStatus === 'activated' ? 'Password set' : data.user.activationEmailStatus || 'not_sent'}</strong>{data.user.activationEmailSentAt ? ` · ${formatDate(data.user.activationEmailSentAt)}` : ''}</p>
    </Panel>
    <Link className="mb-4 inline-block text-sm font-semibold text-forest hover:underline" to="/members">← Back to members</Link>
    <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="Member information">
      {tabs.map((name) => <button key={name} onClick={() => setTab(name)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === name ? 'border-gold text-forest' : 'border-transparent text-slate-500'}`}>{name}</button>)}
    </nav>
    {tab === 'Profile' && <Panel><form className="grid gap-4 sm:grid-cols-2" onSubmit={saveProfile}>
      {[
        ['First name', 'firstName', data.user.firstName], ['Email', 'email', data.user.email], ['Full name', 'fullName', data.profile?.fullName], ['Mobile', 'mobile', data.profile?.mobile], ['Country code', 'countryCode', data.profile?.countryCode || '+91'], ['Interest area', 'interestArea', data.profile?.interestArea],
      ].map(([label, name, value]) => <FormField key={name} label={label}><input className={controlClass} name={name} defaultValue={value || ''} /></FormField>)}
      <Button type="submit" className="sm:col-span-2 sm:justify-self-start">Save profile</Button>
    </form></Panel>}
    {tab === 'Membership' && <Panel><h2 className="mb-3 font-display text-2xl">{data.membership?.plan?.name || data.membership?.plan?.title || 'No membership plan'}</h2><div className="grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
      <p>Status: <Badge>{data.membership?.status || '—'}</Badge></p><p>Member ID: {data.membership?.displayMemberCode ? formatMemberCode(data.membership.displayMemberCode) : 'Not assigned'}</p>
      <p>Points balance: {formatPoints(data.membership?.pointsBalance)}</p><p>Start: {formatDate(data.membership?.startDate)}</p><p>End: {formatDate(data.membership?.endDate)}</p>
    </div></Panel>}
    {tab === 'Family' && <><DataTable columns={familyColumns} rows={data.family || []} empty="This member has no family members on file." />{familyEdit && <Panel className="mt-4"><form className="grid gap-4 sm:grid-cols-2" onSubmit={saveFamily}><h2 className="font-display text-xl">Edit family member</h2>
      <FormField label="Full name"><input className={controlClass} name="fullName" required defaultValue={familyEdit.fullName} /></FormField>
      <FormField label="Relationship"><input className={controlClass} name="relationship" required defaultValue={familyEdit.relationship} /></FormField>
      <FormField label="Gender"><select className={controlClass} name="gender" defaultValue={familyEdit.gender}><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option><option value="prefer_not_to_say">Prefer not to say</option></select></FormField>
      <FormField label="Date of birth"><input className={controlClass} name="dob" type="date" defaultValue={familyEdit.dob ? new Date(familyEdit.dob).toISOString().slice(0, 10) : ''} /></FormField>
      <div className="flex gap-2"><Button type="submit">Save family member</Button><Button type="button" variant="secondary" onClick={() => setFamilyEdit(null)}>Cancel</Button></div>
    </form></Panel>}</>}
    {tab === 'Payments' && <DataTable columns={paymentColumns} rows={data.payments || []} empty="No payments are associated with this member." />}
    {tab === 'Points' && <Panel><h2 className="mb-3 font-display text-xl">Ledger summary</h2>{(data.points || []).map((item) => <p key={item._id} className="border-b border-slate-100 py-2 text-sm">{item._id}: <strong>{formatPoints(item.total)}</strong> points · {item.count} transactions</p>)}</Panel>}
    {confirm && <ConfirmDialog title={`${confirm[0].toUpperCase()}${confirm.slice(1)} member?`} confirmLabel={confirm} onCancel={() => setConfirm('')} onConfirm={() => act(confirm)}>{confirm === 'delete' ? 'This hides the member account and prevents login. This action is recorded.' : `Confirm that you want to ${confirm} this member account.`}</ConfirmDialog>}
    {familyDelete && <ConfirmDialog title="Delete family member?" confirmLabel="Delete" onCancel={() => setFamilyDelete('')} onConfirm={removeFamily}>This family member will be removed from the membership.</ConfirmDialog>}
  </section>;
}
