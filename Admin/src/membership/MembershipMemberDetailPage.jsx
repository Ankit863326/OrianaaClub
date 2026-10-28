import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import {
  Button,
  ConfirmDialog,
  FormField,
  LoadingState,
  PageHeading,
  Panel,
  Toast,
  controlClass,
} from '../components/ui.jsx';
import { membershipMembersApi } from './memberApi.js';
import { formatINR, formatMemberCode, formatMembershipDate, formatPts } from './formatters.js';
import MembershipStatusChip from './MembershipStatusChip.jsx';
import FamilyTab from './tabs/FamilyTab.jsx';
import DocumentsTab from './tabs/DocumentsTab.jsx';
import PaymentsTab from './tabs/PaymentsTab.jsx';
import BillsBookingsTab from './tabs/BillsBookingsTab.jsx';
import PointsLedgerTab from './tabs/PointsLedgerTab.jsx';
import useAutoRefresh from '../hooks/useAutoRefresh.js';

const tabs = [
  'Overview',
  'Family',
  'Documents',
  'Payments',
  'Bills & bookings',
  'Points ledger',
];
const paymentMethods = ['razorpay', 'bank_transfer', 'cheque'];

function escaped(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function formatCardMemberCode(code) {
  return formatMemberCode(code);
}

export default function MembershipMemberDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [qrUrl, setQrUrl] = useState('');
  const [tab, setTab] = useState('Overview');
  const [actionForm, setActionForm] = useState('');
  const [reason, setReason] = useState('');
  const [planId, setPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [transferDocument, setTransferDocument] = useState(null);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const membership = data?.membership;
  const memberName = data?.profile?.fullName || data?.profile?.name || data?.membership?.user?.firstName || 'Member';
  const memberCode = useMemo(
    () => membership?.memberCode ? formatCardMemberCode(membership.memberCode) : '',
    [membership?.memberCode],
  );

  async function load({ silent = false, includeQr = true } = {}) {
    if (!silent) setError('');
    try {
      const detail = await membershipMembersApi.details(id);
      setData(detail);
      if (includeQr && detail.membership?.memberCode) {
        try {
          const qr = await membershipMembersApi.qr(id);
          const nextUrl = URL.createObjectURL(qr.data);
          setQrUrl(nextUrl);
        } catch (failure) {
          if (!silent) setError(errorMessage(failure));
        }
      }
    } catch (failure) {
      if (!silent) setError(errorMessage(failure));
    }
  }

  useAutoRefresh(() => load({ silent: true, includeQr: false }), { enabled: tab === 'Overview' });

  useEffect(() => {
    load();
    membershipMembersApi.plans()
      .then((result) => setPlans((result.items || []).filter((plan) => plan.isActive)))
      .catch((failure) => setError(errorMessage(failure)));
  }, [id]);

  useEffect(() => () => {
    if (qrUrl) URL.revokeObjectURL(qrUrl);
  }, [qrUrl]);

  async function submitAction() {
    setBusy(true);
    setError('');
    try {
      if (confirmation === 'deactivate') {
        await membershipMembersApi.deactivate(id, reason.trim());
        setNotice('Membership deactivated.');
      } else if (confirmation === 'renew') {
        const result = await membershipMembersApi.renew(id, { planId, paymentMethod });
        setNotice(`Renewal or upgrade requested${result.payment?._id ? ` (${result.payment._id})` : ''}.`);
      } else if (confirmation === 'transfer') {
        await membershipMembersApi.transferToNominee(id, reason.trim(), transferDocument);
        setNotice('Membership transfer to nominee requested.');
      }
      setConfirmation('');
      setActionForm('');
      setReason('');
      setTransferDocument(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function printMemberCard() {
    if (!qrUrl) {
      setError('The member QR code is not available to print.');
      return;
    }
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError('Allow pop-ups to print the member card.');
      return;
    }
    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>Membership card</title><style>
      body{font-family:Arial,sans-serif;margin:32px;color:#0f172a}
      main{width:340px;border:1px solid #cbd5e1;border-radius:16px;padding:24px;text-align:center}
      img{width:160px;height:160px;object-fit:contain;margin:16px auto}
      h1{font-size:20px;margin:0 0 8px}.tier{font-size:14px;font-weight:600;margin:12px 0 4px;color:#334155}p{margin:8px 0;color:#475569}
      @media print{body{margin:0}main{break-inside:avoid}}
    </style></head><body><main>
      <h1>${escaped(memberName)}</h1>
      <h2 class="tier">${escaped(membership?.plan?.name || 'Membership')}</h2>
      <strong>${escaped(memberCode)}</strong>
      <img src="${escaped(qrUrl)}" alt="Member QR code">
    </main><script>window.onload=()=>{window.focus();window.print();};</script></body></html>`);
    printWindow.document.close();
  }

  if (!data && !error) return <LoadingState />;
  if (!data && error) {
    return <section>
      <PageHeading eyebrow="MEMBERSHIP" title="Member details" />
      <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>
      <Button variant="secondary" onClick={load}>Retry</Button>
    </section>;
  }

  const overview = <div className="grid gap-5">
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="text-sm text-slate-500">Member ID</p>
          <p className="mb-1 text-sm font-semibold text-slate-700">{membership?.plan?.name || 'Membership'}</p>
          <h2 className="font-display text-2xl text-slate-900">{memberCode || 'Not assigned'}</h2>
          <p className="mt-2 text-slate-700">{memberName}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <MembershipStatusChip status={membership?.status} />
            {membership?.earlyBirdApplied && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Early bird</span>}
          </div>
        </div>
        {qrUrl && <img className="size-32 rounded-xl border border-slate-200 bg-white p-2" src={qrUrl} alt={`QR code for ${memberCode}`} />}
      </div>
      <dl className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-sm text-slate-500">Points balance</dt><dd className="mt-1 font-semibold">{formatPts(membership?.pointsBalance)}</dd></div>
        <div><dt className="text-sm text-slate-500">Points expiry</dt><dd className="mt-1 font-semibold">{formatMembershipDate(membership?.pointsExpireAt)}</dd></div>
        <div><dt className="text-sm text-slate-500">Membership expiry</dt><dd className="mt-1 font-semibold">{formatMembershipDate(membership?.membershipExpireAt)}</dd></div>
        <div><dt className="text-sm text-slate-500">Term number</dt><dd className="mt-1 font-semibold">{membership?.termNumber ?? '—'}</dd></div>
        <div><dt className="text-sm text-slate-500">Tier price</dt><dd className="mt-1 font-semibold">{formatINR(membership?.plan?.price)}</dd></div>
      </dl>
      <Button className="mt-5" variant="secondary" onClick={printMemberCard} disabled={!qrUrl}>Print member card</Button>
    </Panel>

    <Panel>
      <h2 className="mb-4 font-display text-xl">Membership actions</h2>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { setActionForm('renew'); setPlanId(''); }}>Renew / Upgrade</Button>
        {membership?.status === 'active' && <Button variant="danger" onClick={() => setActionForm('deactivate')}>Deactivate</Button>}
        <Button variant="secondary" disabled={!data.nominee} onClick={() => setActionForm('transfer')}>
          Transfer to nominee
        </Button>
      </div>
      {!data.nominee && <p className="mt-3 text-sm text-slate-500">A nominee is not configured for this membership.</p>}

      {actionForm === 'deactivate' && <form className="mt-5 grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim()) setConfirmation('deactivate');
      }}>
        <FormField label="Reason for deactivation">
          <textarea className={controlClass} rows="3" required maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" variant="danger" disabled={!reason.trim()}>Continue</Button>
          <Button type="button" variant="secondary" onClick={() => setActionForm('')}>Cancel</Button>
        </div>
      </form>}

      {actionForm === 'renew' && <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
        event.preventDefault();
        if (planId) setConfirmation('renew');
      }}>
        <FormField label="Membership tier">
          <select className={controlClass} required value={planId} onChange={(event) => setPlanId(event.target.value)}>
            <option value="">Choose a tier</option>
            {plans.map((plan) => <option key={plan._id} value={plan._id}>{plan.name} — {formatINR(plan.price)}</option>)}
          </select>
        </FormField>
        <FormField label="Payment method">
          <select className={controlClass} value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
            {paymentMethods.map((method) => <option key={method} value={method}>{method.replaceAll('_', ' ')}</option>)}
          </select>
        </FormField>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={!planId || !plans.length}>Continue</Button>
          <Button type="button" variant="secondary" onClick={() => setActionForm('')}>Cancel</Button>
        </div>
        {!plans.length && <p className="text-sm text-slate-500 sm:col-span-2">No active membership tiers are available.</p>}
      </form>}

      {actionForm === 'transfer' && <form className="mt-5 grid gap-4" onSubmit={(event) => {
        event.preventDefault();
        if (reason.trim() && transferDocument) setConfirmation('transfer');
      }}>
        <p className="text-sm text-slate-600">Nominee: {data.nominee?.name || '—'}{data.nominee?.relation ? ` (${data.nominee.relation})` : ''}</p>
        <FormField label="Reason for transfer">
          <textarea className={controlClass} rows="3" required maxLength="1000" value={reason} onChange={(event) => setReason(event.target.value)} />
        </FormField>
        <FormField label="Supporting document (JPG, PNG, WebP or PDF; max 10 MB)">
          <input
            className={controlClass}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            onChange={(event) => setTransferDocument(event.target.files?.[0] || null)}
          />
        </FormField>
        <div className="flex gap-2">
          <Button type="submit" disabled={!reason.trim() || !transferDocument}>Continue</Button>
          <Button type="button" variant="secondary" onClick={() => setActionForm('')}>Cancel</Button>
        </div>
      </form>}
    </Panel>
  </div>;

  const tabContent = {
    Overview: overview,
    Family: <FamilyTab />,
    Documents: <DocumentsTab />,
    Payments: <PaymentsTab />,
    'Bills & bookings': <BillsBookingsTab />,
    'Points ledger': <PointsLedgerTab />,
  }[tab];

  return <section>
    <PageHeading
      eyebrow="MEMBERSHIP"
      title={memberName}
      description={memberCode}
    />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <div className="mb-5 flex flex-wrap gap-2 border-b border-slate-200 pb-3" role="tablist" aria-label="Membership details">
      {tabs.map((item) => <button
        key={item}
        type="button"
        role="tab"
        aria-selected={tab === item}
        className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${tab === item ? 'bg-gold text-midnight' : 'text-slate-600 hover:bg-slate-100'}`}
        onClick={() => setTab(item)}
      >{item}</button>)}
    </div>
    {tabContent}
    {confirmation && <ConfirmDialog
      title={confirmation === 'deactivate' ? 'Deactivate membership?' : confirmation === 'transfer' ? 'Transfer membership to nominee?' : 'Create renewal or upgrade?'}
      onCancel={() => setConfirmation('')}
      onConfirm={submitAction}
      confirmLabel={confirmation === 'deactivate' ? 'Deactivate' : confirmation === 'transfer' ? 'Transfer' : 'Continue'}
      busy={busy}
    >
      {confirmation === 'deactivate'
        ? `Confirm deactivation. Reason: ${reason}`
        : confirmation === 'transfer'
          ? `Confirm transfer to ${data.nominee?.name || 'the selected nominee'}. Reason: ${reason}`
          : `Create a renewal or upgrade for ${plans.find((plan) => plan._id === planId)?.name || 'the selected tier'}?`}
    </ConfirmDialog>}
  </section>;
}
