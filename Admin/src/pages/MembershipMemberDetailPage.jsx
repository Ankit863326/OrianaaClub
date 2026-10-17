import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import { fetchPrivateFile, membershipApi } from '../api/membership.js';
import { Badge, Button, DataTable, EmptyState, FormField, LoadingState, PageHeading, Pagination, Panel, Toast, controlClass, formatDate, formatPaise, formatPoints, formatRupees } from '../components/ui.jsx';

const tabs = ['Overview', 'Family', 'Bills & bookings', 'Points ledger', 'Payments', 'Documents'];
const offlinePaymentMethods = ['bank_transfer', 'cheque', 'rtgs'];
const legacyOfflinePaymentMethods = ['cash', 'manual', 'netbanking'];
const renewalPaymentMethods = ['razorpay', 'bank_transfer', 'cheque'];

export default function MembershipMemberDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('Overview');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordLinkBusy, setPasswordLinkBusy] = useState(false);
  const [qr, setQr] = useState('');
  const [familyRequests, setFamilyRequests] = useState([]);
  const [bills, setBills] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [ledgerFilters, setLedgerFilters] = useState({ page: 1, limit: 20, type: '' });
  const [billPage, setBillPage] = useState(1);
  const [familyDraft, setFamilyDraft] = useState(null);
  const [familyEdit, setFamilyEdit] = useState(null);
  const [renewal, setRenewal] = useState({ planId: '', paymentMethod: 'bank_transfer' });
  const [offlinePayment, setOfflinePayment] = useState({ method: 'bank_transfer', reference: '', note: '' });
  const [adjustment, setAdjustment] = useState({ amount: '', direction: '+', reason: '' });
  const [reason, setReason] = useState('');
  const [transferFile, setTransferFile] = useState(null);
  const [actionForm, setActionForm] = useState('');

  const membership = data?.membership;
  const pendingPayment = data?.payments?.find((payment) => payment.status === 'pending');
  const planFeePaise = pendingPayment?.baseAmount ?? Number(membership?.plan?.price || 0) * 100;
  const gstEnabled = pendingPayment
    ? (pendingPayment.gstEnabled ?? pendingPayment.gstAmount > 0)
    : (data?.gstSettings?.enabled ?? true);
  const gstRate = pendingPayment?.gstRate ?? data?.gstSettings?.rate ?? 18;
  const gstLabel = pendingPayment?.gstLabel || data?.gstSettings?.label || 'GST';
  const gstAmountPaise = pendingPayment?.gstAmount
    ?? (gstEnabled ? Math.round(planFeePaise * gstRate / 100) : 0);
  const totalAmountPaise = pendingPayment?.totalAmount ?? planFeePaise + gstAmountPaise;
  const filteredRequests = useMemo(() => familyRequests.filter((request) => {
    const record = request.membership?._id || request.membership;
    return String(record) === String(id);
  }), [familyRequests, id]);

  async function load() {
    setError('');
    try {
      setData(await membershipApi.member(id));
    } catch (failure) { setError(errorMessage(failure)); }
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    let active = true;
    membershipApi.familyRequests({ page: 1, limit: 100 })
      .then((result) => { if (active) setFamilyRequests(result.items || []); })
      .catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [id]);
  useEffect(() => {
    if (!membership?.memberCode) return undefined;
    let active = true;
    fetchPrivateFile(membershipApi.memberQr(id)).then((url) => {
      if (active) setQr(url);
      else URL.revokeObjectURL(url);
    }).catch((failure) => { if (active) setError(errorMessage(failure)); });
    return () => { active = false; };
  }, [id, membership?.memberCode]);
  useEffect(() => {
    if (tab !== 'Bills & bookings' || !membership?.memberCode) return;
    membershipApi.bills({ page: billPage, limit: 20, memberCode: membership.memberCode })
      .then(setBills).catch((failure) => setError(errorMessage(failure)));
  }, [tab, billPage, membership?.memberCode]);
  useEffect(() => {
    if (tab !== 'Points ledger') return;
    membershipApi.ledger(id, ledgerFilters).then(setLedger)
      .catch((failure) => setError(errorMessage(failure)));
  }, [id, tab, ledgerFilters]);

  async function refresh(message) {
    setNotice(message);
    setActionForm('');
    setReason('');
    await load();
  }

  async function resendPasswordLink() {
    if (!membership?.user?._id) return;
    setPasswordLinkBusy(true);
    setError('');
    try {
      const result = await membershipApi.resendActivation(membership.user._id);
      setNotice(result.message || 'Password setup link requested.');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setPasswordLinkBusy(false);
    }
  }
  async function run(action) {
    setBusy(true);
    setError('');
    try {
      if (action === 'deactivate') {
        if (!reason.trim()) throw new Error('A deactivation reason is required.');
        if (!window.confirm('Deactivate this membership?')) return;
        await membershipApi.deactivate(id, reason);
        await refresh('Membership deactivated.');
      } else if (action === 'renew') {
        const result = await membershipApi.renew(id, renewal);
        setNotice(`Renewal payment created${result.payment?._id ? ` (${result.payment._id})` : ''}.`);
        setActionForm('');
        await load();
      } else if (action === 'transfer') {
        if (!reason.trim() || !transferFile) throw new Error('A reason and supporting document are required.');
        if (!window.confirm('Transfer this membership to the selected nominee?')) return;
        await membershipApi.transfer(id, reason, transferFile);
        await refresh('Membership transferred to nominee.');
      } else if (action === 'add-family') {
        const body = new FormData();
        Object.entries(familyDraft).forEach(([key, value]) => {
          if (key === 'photo') {
            if (value) body.append('photo', value);
          } else if (value !== '') body.append(key, value);
        });
        await membershipApi.addFamily(id, body);
        setFamilyDraft(null);
        await refresh('Family member added.');
      } else if (action === 'save-family') {
        const body = new FormData();
        Object.entries(familyEdit.values).forEach(([key, value]) => {
          if (key === 'document') {
            if (value) body.append('document', value);
          } else if (value !== '') body.append(key, value);
        });
        await membershipApi.updateFamily(familyEdit.id, body);
        setFamilyEdit(null);
        await refresh('Family member updated.');
      } else if (action === 'remove-family') {
        if (!window.confirm('Remove this family member? The membership must retain at least one adult.')) return;
        await membershipApi.removeFamily(familyEdit.id, reason);
        setFamilyEdit(null);
        await refresh('Family member removed.');
      } else if (action === 'adjust-points') {
        if (!adjustment.reason.trim()) throw new Error('An adjustment reason is required.');
        await membershipApi.adjustPoints(id, {
          amount: Number(adjustment.amount),
          direction: adjustment.direction,
          reason: adjustment.reason,
        });
        setAdjustment({ amount: '', direction: '+', reason: '' });
        await refresh('Points balance adjusted.');
      } else if (action === 'record-payment') {
        await membershipApi.recordPayment({
          membershipId: id,
          method: offlinePayment.method,
          reference: offlinePayment.reference,
          paymentDate: offlinePayment.paymentDate || undefined,
          note: offlinePayment.note,
        });
        await refresh('Offline payment recorded.');
      }
    } catch (failure) {
      setError(errorMessage(failure, failure.message || 'The requested action failed.'));
    } finally { setBusy(false); }
  }

  async function decideRequest(requestId, approve) {
    const result = await window.confirm(`${approve ? 'Approve' : 'Reject'} this family request?`);
    if (!result) return;
    try {
      await membershipApi.decideFamilyRequest(requestId, approve);
      setFamilyRequests((current) => current.filter((item) => item._id !== requestId));
      await refresh(`Family request ${approve ? 'approved' : 'rejected'}.`);
    } catch (failure) { setError(errorMessage(failure)); }
  }

  async function openVerificationDocument(file) {
    try {
      const url = await fetchPrivateFile(membershipApi.verificationDocument(id, file.id));
      const link = window.document.createElement('a');
      link.href = url;
      link.download = file.originalName || 'verification-document';
      link.click();
      URL.revokeObjectURL(url);
    } catch (failure) { setError(errorMessage(failure)); }
  }

  async function confirmPayment(paymentId) {
    if (!window.confirm('Confirm this offline payment? Cheques should only be confirmed after clearing.')) return;
    try {
      await membershipApi.confirmPayment(paymentId);
      await refresh('Offline payment confirmed.');
    } catch (failure) { setError(errorMessage(failure)); }
  }

  if (!data && !error) return <LoadingState />;
  if (!data) return <Toast kind="error">{error}</Toast>;

  const billColumns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'serviceType', label: 'Service' },
    { key: 'bookingId', label: 'Booking / bill', render: (row) => `${row.bookingId || '—'} · ${row.billId}` },
    { key: 'billAmount', label: 'Bill', render: (row) => formatRupees(row.billAmount) },
    { key: 'pointsUsed', label: 'Points used', render: (row) => `${formatPoints(row.pointsUsed)} pts` },
    { key: 'status', label: 'Status' },
    { key: 'cancel', label: '', render: (row) => row.status === 'confirmed' && <Button variant="danger" onClick={async () => { if (!window.confirm('Cancel this bill?')) return; try { await membershipApi.cancelBill(row._id); setNotice('Bill cancelled.'); const result = await membershipApi.bills({ page: billPage, limit: 20, memberCode: membership.memberCode }); setBills(result); } catch (failure) { setError(errorMessage(failure)); } }}>Cancel</Button> },
  ];
  const ledgerColumns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'type', label: 'Type' },
    { key: 'amount', label: 'Amount', render: (row) => `${row.direction}${formatPoints(row.amount)} pts` },
    { key: 'balanceAfter', label: 'Balance after', render: (row) => `${formatPoints(row.balanceAfter)} pts` },
    { key: 'note', label: 'Note' },
  ];
  const familyColumns = () => [
    { key: 'name', label: 'Name', render: (row) => row.name || row.fullName },
    { key: 'relation', label: 'Relation', render: (row) => row.relation || row.relationship },
    { key: 'type', label: 'Type' },
    { key: 'nominee', label: 'Nominee', render: (row) => row.isNominee ? <Badge>Nominee</Badge> : '—' },
    { key: 'actions', label: '', render: (row) => <div className="flex flex-wrap gap-2">
      {!row.isNominee && row.type === 'adult' && <Button variant="secondary" onClick={async () => { try { await membershipApi.setNominee(id, row._id); await refresh('Nominee updated.'); } catch (failure) { setError(errorMessage(failure)); } }}>Set as nominee</Button>}
      <Button variant="secondary" onClick={() => setFamilyEdit({ id: row._id, values: { name: row.name || row.fullName, relation: row.relation || row.relationship, dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth).toISOString().slice(0, 10) : '', phone: row.phone || '' } })}>Edit</Button>
      {!row.isPrimary && <Button variant="danger" onClick={() => { setFamilyEdit({ id: row._id, values: {} }); setReason(''); setActionForm('remove-family'); }}>Remove</Button>}
    </div> },
  ];
  const paymentColumns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'method', label: 'Method' },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
    { key: 'totalAmount', label: 'Total', render: (row) => formatPaise(row.totalAmount) },
    { key: 'reference', label: 'Reference' },
    { key: 'action', label: '', render: (row) => row.status === 'pending' && [...offlinePaymentMethods, ...legacyOfflinePaymentMethods].includes(row.method) && <Button onClick={() => confirmPayment(row._id)}>Confirm payment</Button> },
  ];
  const docColumns = [
    { key: 'originalName', label: 'Document' },
    { key: 'mimeType', label: 'Format' },
    { key: 'uploadedAt', label: 'Uploaded', render: (row) => formatDate(row.uploadedAt) },
    { key: 'actions', label: '', render: (row) => <Button variant="secondary" onClick={() => openVerificationDocument(row)}>Download securely</Button> },
  ];

  return <section>
    <PageHeading eyebrow="MEMBERSHIP RECORD" title={data.profile?.fullName || membership.user?.firstName || 'Member'} description={`${membership.formattedMemberCode || 'No member code'} · ${membership.user?.email || ''}`} actions={<Link to="/membership/members" className="text-sm font-semibold text-forest hover:underline">← Membership members</Link>} />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <nav className="mb-5 flex gap-2 overflow-x-auto border-b border-slate-200" aria-label="Membership detail sections">
      {tabs.map((name) => <button key={name} onClick={() => setTab(name)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === name ? 'border-gold text-forest' : 'border-transparent text-slate-500'}`}>{name}</button>)}
    </nav>

    {tab === 'Overview' && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px]">
      <Panel className="grid gap-3 text-sm sm:grid-cols-2 xl:col-span-2">
        <h2 className="font-semibold sm:col-span-2">Application lifecycle</h2>
        <p>Application state: <Badge>{membership.user?.status === 'active' ? 'Active' : membership.status === 'draft' ? 'Draft' : membership.status === 'pending_payment' ? 'Payment pending' : ['active', 'pending_verification'].includes(membership.status) ? 'Paid' : 'Password not set'}</Badge></p>
        <p>Password link status: <strong>{membership.user?.status === 'active' || membership.user?.activationEmailStatus === 'activated' ? 'Password set' : membership.user?.activationEmailStatus || 'not_sent'}</strong>{membership.user?.activationEmailSentAt ? ` · ${formatDate(membership.user.activationEmailSentAt)}` : ''}</p>
        {membership.user?.status === 'pending' && <Button variant="secondary" disabled={passwordLinkBusy} onClick={resendPasswordLink}>{passwordLinkBusy ? 'Sending…' : 'Resend password link'}</Button>}
      </Panel>
      <Panel className="grid gap-3 text-sm sm:grid-cols-2">
        <h2 className="font-display text-2xl sm:col-span-2">{membership.plan?.name || membership.plan?.title || 'Membership'}</h2>
        <p>Status: <Badge>{membership.status}</Badge></p><p>Term: {membership.termNumber}</p>
        <p>Points balance: <strong>{formatPoints(membership.pointsBalance)} pts</strong></p><p>Points expiry: {formatDate(membership.pointsExpireAt)}</p>
        <p>Membership expiry: {formatDate(membership.membershipExpireAt)}</p><p>Member number: {membership.memberNumber || '—'}</p>
        <p>Early bird: {membership.earlyBirdApplied ? <Badge>Applied</Badge> : 'No'}</p>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          {membership.status === 'active' && <Button variant="danger" onClick={() => setActionForm('deactivate')}>Deactivate</Button>}
          {data.canRenew && <Button onClick={() => { setRenewal({ ...renewal, planId: data.renewalPlans[0]?.id || '' }); setActionForm('renew'); }}>Renew / upgrade</Button>}
          {data.nominee && <Button variant="secondary" onClick={() => setActionForm('transfer')}>Transfer to nominee</Button>}
          <Button variant="secondary" onClick={() => window.print()}>Print member card</Button>
        </div>
      </Panel>
      <Panel className="grid justify-items-center gap-3 text-center">
        {qr && <img src={qr} alt="Membership QR code" className="size-44" />}
        <strong>{membership.formattedMemberCode || 'Member code not assigned'}</strong>
        <p className="text-sm text-slate-500">{data.nominee ? `Nominee: ${data.nominee.name}` : 'No nominee selected'}</p>
      </Panel>
      {actionForm === 'deactivate' && <Panel className="grid gap-3 xl:col-span-2">
        <h3 className="font-semibold">Deactivate membership</h3>
        <FormField label="Required reason"><textarea className={controlClass} rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>
        <Button variant="danger" disabled={busy || !reason.trim()} onClick={() => run('deactivate')}>Confirm deactivation</Button>
      </Panel>}
      {actionForm === 'renew' && <Panel className="grid gap-4 sm:grid-cols-2 xl:col-span-2">
        <h3 className="font-semibold sm:col-span-2">Create renewal or upgrade</h3>
        <FormField label="Tier"><select className={controlClass} value={renewal.planId} onChange={(event) => setRenewal({ ...renewal, planId: event.target.value })}>{data.renewalPlans.map((plan) => <option value={plan.id} key={plan.id}>{plan.name} · {formatRupees(plan.price)} · {formatPoints(plan.renewalPoints)} pts</option>)}</select></FormField>
        <FormField label="Payment method"><select className={controlClass} value={renewal.paymentMethod} onChange={(event) => setRenewal({ ...renewal, paymentMethod: event.target.value })}>{renewalPaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></FormField>
        <div className="flex gap-2 sm:col-span-2"><Button disabled={busy || !renewal.planId} onClick={() => run('renew')}>Create renewal payment</Button><Button variant="secondary" onClick={() => setActionForm('')}>Cancel</Button></div>
      </Panel>}
      {actionForm === 'transfer' && <Panel className="grid gap-4 xl:col-span-2">
        <h3 className="font-semibold">Transfer to {data.nominee?.name || 'nominee'}</h3>
        <FormField label="Required reason"><textarea className={controlClass} rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>
        <FormField label="Supporting document"><input className={controlClass} type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(event) => setTransferFile(event.target.files?.[0] || null)} /></FormField>
        <div className="flex gap-2"><Button variant="danger" disabled={busy || !reason.trim() || !transferFile} onClick={() => run('transfer')}>Confirm transfer</Button><Button variant="secondary" onClick={() => setActionForm('')}>Cancel</Button></div>
      </Panel>}
    </div>}

    {tab === 'Family' && <div className="grid gap-5">
      <Panel className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-xl">Family members</h2><p className="text-sm text-slate-500">Maximum six members; at least one adult must remain.</p></div><Button onClick={() => { setFamilyDraft({ name: '', relation: '', dateOfBirth: '', phone: '', linkedUser: '', photo: null }); setActionForm('add-family'); }}>Add family member</Button></Panel>
      {filteredRequests.length > 0 && <Panel><h3 className="mb-3 font-semibold">Pending family requests</h3><div className="grid gap-3">{filteredRequests.map((request) => <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-3 text-sm"><span>{request.name || request.fullName} · {request.pendingAction}</span><div className="flex gap-2"><Button onClick={() => decideRequest(request._id, true)}>Approve</Button><Button variant="danger" onClick={() => decideRequest(request._id, false)}>Reject</Button></div></div>)}</div></Panel>}
      <Panel><h3 className="mb-3 font-semibold">Adults</h3><DataTable columns={familyColumns()} rows={data.family.adults} empty="No adults recorded." /></Panel>
      <Panel><h3 className="mb-3 font-semibold">Children</h3><DataTable columns={familyColumns()} rows={data.family.children} empty="No children recorded." /></Panel>
      {actionForm === 'add-family' && familyDraft && <Panel><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); run('add-family'); }}>
        <h3 className="font-semibold sm:col-span-2">Add family member</h3>
        {[['Name', 'name'], ['Relation', 'relation'], ['Date of birth', 'dateOfBirth'], ['Phone', 'phone'], ['Linked member account ID (optional)', 'linkedUser']].map(([label, key]) => <FormField key={key} label={label}><input className={controlClass} type={key === 'dateOfBirth' ? 'date' : 'text'} value={familyDraft[key]} onChange={(event) => setFamilyDraft({ ...familyDraft, [key]: event.target.value })} /></FormField>)}
        <FormField label="Photo (optional)"><input className={controlClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFamilyDraft({ ...familyDraft, photo: event.target.files?.[0] || null })} /></FormField>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>Add member</Button><Button type="button" variant="secondary" onClick={() => setActionForm('')}>Cancel</Button></div>
      </form></Panel>}
      {familyEdit && actionForm !== 'remove-family' && <Panel><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); run('save-family'); }}>
        <h3 className="font-semibold sm:col-span-2">Edit family member</h3>
        {Object.entries({ name: 'Name', relation: 'Relation', dateOfBirth: 'Date of birth', phone: 'Phone' }).map(([key, label]) => <FormField key={key} label={label}><input className={controlClass} type={key === 'dateOfBirth' ? 'date' : 'text'} value={familyEdit.values[key]} onChange={(event) => setFamilyEdit({ ...familyEdit, values: { ...familyEdit.values, [key]: event.target.value } })} /></FormField>)}
        <FormField label="ID proof (private, optional)"><input className={controlClass} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFamilyEdit({ ...familyEdit, values: { ...familyEdit.values, document: event.target.files?.[0] || null } })} /></FormField>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>Save</Button><Button type="button" variant="secondary" onClick={() => { setFamilyEdit(null); setActionForm(''); }}>Cancel</Button></div>
      </form></Panel>}
      {actionForm === 'remove-family' && <Panel className="grid gap-3"><h3 className="font-semibold">Remove family member</h3><p className="text-sm text-slate-600">The membership must retain at least one active adult.</p><FormField label="Reason (optional)"><textarea className={controlClass} rows="2" value={reason} onChange={(event) => setReason(event.target.value)} /></FormField><div className="flex gap-2"><Button variant="danger" disabled={busy} onClick={() => run('remove-family')}>Confirm removal</Button><Button variant="secondary" onClick={() => { setFamilyEdit(null); setActionForm(''); }}>Cancel</Button></div></Panel>}
    </div>}

    {tab === 'Bills & bookings' && <><DataTable columns={billColumns} rows={bills?.items || []} empty="No bills or bookings recorded." /><Pagination info={bills} onPage={setBillPage} /></>}
    {tab === 'Points ledger' && <div className="grid gap-4">
      <Panel className="grid gap-3 sm:grid-cols-[1fr_auto]"><FormField label="Ledger type"><select className={controlClass} value={ledgerFilters.type} onChange={(event) => setLedgerFilters({ ...ledgerFilters, type: event.target.value, page: 1 })}><option value="">All entries</option>{['credit_joining', 'credit_renewal', 'debit_redeem', 'refund', 'expire', 'admin_adjust'].map((type) => <option key={type}>{type}</option>)}</select></FormField></Panel>
      <DataTable columns={ledgerColumns} rows={ledger?.items || []} empty="No ledger entries." /><Pagination info={ledger} onPage={(page) => setLedgerFilters({ ...ledgerFilters, page })} />
      <Panel><form className="grid gap-4 sm:grid-cols-3" onSubmit={(event) => { event.preventDefault(); run('adjust-points'); }}>
        <h3 className="font-semibold sm:col-span-3">Manual points adjustment</h3>
        <FormField label="Points"><input className={controlClass} type="number" min="1" step="1" required value={adjustment.amount} onChange={(event) => setAdjustment({ ...adjustment, amount: event.target.value })} /></FormField>
        <FormField label="Direction"><select className={controlClass} value={adjustment.direction} onChange={(event) => setAdjustment({ ...adjustment, direction: event.target.value })}><option value="+">Credit</option><option value="-">Debit</option></select></FormField>
        <FormField label="Required reason"><input className={controlClass} required value={adjustment.reason} onChange={(event) => setAdjustment({ ...adjustment, reason: event.target.value })} /></FormField>
        <Button type="submit" disabled={busy}>Adjust points</Button>
      </form></Panel>
    </div>}

    {tab === 'Payments' && <div className="grid gap-5">
      <DataTable columns={paymentColumns} rows={data.payments} empty="No payment records." />
      {membership.status === 'pending_payment' && <Panel><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); run('record-payment'); }}>
        <h3 className="font-semibold sm:col-span-2">Record offline payment</h3>
        <div className="text-sm text-slate-600 sm:col-span-2">
          <p>Plan fee: {formatPaise(planFeePaise)}</p>
          {gstEnabled && <p>{gstLabel} ({gstRate}%): {formatPaise(gstAmountPaise)}</p>}
          <p>Total to record: <strong>{formatPaise(totalAmountPaise)}</strong></p>
        </div>
        <FormField label="Method"><select className={controlClass} value={offlinePayment.method} onChange={(event) => setOfflinePayment({ ...offlinePayment, method: event.target.value })}>{offlinePaymentMethods.map((method) => <option key={method}>{method}</option>)}</select></FormField>
        <FormField label="Reference / cheque number"><input className={controlClass} required value={offlinePayment.reference} onChange={(event) => setOfflinePayment({ ...offlinePayment, reference: event.target.value })} /></FormField>
        <FormField label="Payment date"><input className={controlClass} type="date" value={offlinePayment.paymentDate || ''} onChange={(event) => setOfflinePayment({ ...offlinePayment, paymentDate: event.target.value })} /></FormField>
        <FormField label="Note"><input className={controlClass} value={offlinePayment.note} onChange={(event) => setOfflinePayment({ ...offlinePayment, note: event.target.value })} /></FormField>
        <Button type="submit" disabled={busy}>Record payment</Button>
      </form></Panel>}
    </div>}

    {tab === 'Documents' && <div className="grid gap-5">
      <Panel><h3 className="mb-3 font-semibold">Tier verification documents</h3><DataTable columns={docColumns} rows={membership.verificationDocs || []} empty="No verification documents." />
        {membership.status === 'pending_verification' && <div className="mt-4 flex flex-wrap gap-2"><Button onClick={async () => { try { await membershipApi.approveVerification(id); await refresh('Membership verification approved.'); } catch (failure) { setError(errorMessage(failure)); } }}>Approve verification</Button><Button variant="danger" onClick={() => setActionForm('reject-verification')}>Reject verification</Button></div>}
        {actionForm === 'reject-verification' && <div className="mt-4 grid gap-3"><FormField label="Required rejection reason"><textarea className={controlClass} rows="3" value={reason} onChange={(event) => setReason(event.target.value)} /></FormField><Button variant="danger" disabled={!reason.trim()} onClick={async () => { try { await membershipApi.rejectVerification(id, reason); await refresh('Verification rejected.'); } catch (failure) { setError(errorMessage(failure)); } }}>Confirm rejection</Button></div>}
      </Panel>
      <Panel><h3 className="mb-3 font-semibold">Company details</h3>{data.companyDetails?.companyName ? <dl className="grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Company</dt><dd>{data.companyDetails.companyName}</dd></div><div><dt className="text-slate-500">GST number</dt><dd>{data.companyDetails.gstNumber}</dd></div><div><dt className="text-slate-500">Contact person</dt><dd>{data.companyDetails.contactPerson}</dd></div></dl> : <EmptyState>No company details recorded.</EmptyState>}</Panel>
    </div>}
  </section>;
}
