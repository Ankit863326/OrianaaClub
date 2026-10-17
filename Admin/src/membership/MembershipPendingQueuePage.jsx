import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  FormField,
  LoadingState,
  PageHeading,
  Pagination,
  Panel,
  Toast,
  controlClass,
  formatDate,
} from '../components/ui.jsx';
import { membershipApi } from '../api/membership.js';
import { formatINR, formatMemberCode } from './formatters.js';
import useAutoRefresh from '../hooks/useAutoRefresh.js';

const pageSize = 20;
const initialPages = { verification: 1, payments: 1, family: 1 };

function membershipId(value) {
  return String(value?._id || value || '');
}

function memberLink(id, label) {
  return id
    ? <Link className="font-semibold text-forest underline" to={`/membership/members/${encodeURIComponent(id)}`}>{label}</Link>
    : label;
}

function paymentAmount(payment) {
  return payment.totalAmount
    ? Number(payment.totalAmount) / 100
    : Number(payment.amount || 0);
}

export default function MembershipPendingQueuePage() {
  const [pages, setPages] = useState(initialPages);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState(null);
  const [reason, setReason] = useState('');

  async function load(nextPages = pages, { silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const [verification, payments, family] = await Promise.all([
        membershipApi.members({ status: 'pending_verification', page: nextPages.verification, limit: pageSize }),
        membershipApi.payments({ status: 'pending', page: nextPages.payments, limit: pageSize }),
        membershipApi.familyRequests({ page: nextPages.family, limit: pageSize }),
      ]);
      const paymentMemberships = [...new Set(payments.items.map((payment) => membershipId(payment.membership)).filter(Boolean))];
      const paymentDetails = await Promise.all(paymentMemberships.map(async (id) => (
        [id, await membershipApi.member(id)]
      )));
      setData({
        verification,
        payments: {
          ...payments,
          items: payments.items.map((payment) => ({
            ...payment,
            memberDetail: paymentDetails.find(([id]) => id === membershipId(payment.membership))?.[1],
          })),
        },
        family,
      });
      setPages(nextPages);
    } catch (failure) {
      if (!silent) setError(errorMessage(failure));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useAutoRefresh(() => load(pages, { silent: true }));

  useEffect(() => {
    load(initialPages);
  }, []);

  function requestAction(action) {
    setReason('');
    setError('');
    setConfirmation(action);
  }

  async function confirmAction() {
    if (!confirmation) return;
    const requiresReason = confirmation.type === 'reject-verification' || confirmation.type === 'reject-family';
    if (requiresReason && !reason.trim()) {
      setError('A reason is required to reject this request.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (confirmation.type === 'approve-verification') {
        await membershipApi.approveVerification(confirmation.row._id);
        setNotice('Membership verification approved.');
      } else if (confirmation.type === 'reject-verification') {
        await membershipApi.rejectVerification(confirmation.row._id, reason.trim());
        setNotice('Membership verification rejected.');
      } else if (confirmation.type === 'confirm-payment') {
        await membershipApi.confirmPayment(confirmation.row._id);
        setNotice('Payment confirmed.');
      } else if (confirmation.type === 'approve-family' || confirmation.type === 'reject-family') {
        await membershipApi.decideFamilyRequest(
          confirmation.row._id,
          confirmation.type === 'approve-family',
          reason.trim(),
        );
        setNotice(confirmation.type === 'approve-family' ? 'Family request approved.' : 'Family request rejected.');
      }
      setConfirmation(null);
      setReason('');
      const firstPages = { ...initialPages };
      setPages(firstPages);
      await load(firstPages);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const counts = data ? [
    data.verification.total || 0,
    data.payments.total || 0,
    data.family.total || 0,
  ] : [];
  const nothingPending = data && counts.every((count) => count === 0);

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Pending Queue" description="Review membership verification, payments, and family requests." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {!data && loading && <LoadingState />}
    {!data && error && <Button variant="secondary" onClick={() => load()}>Retry</Button>}
    {data && <>
      {loading && <p className="mb-4 text-sm text-slate-500" role="status">Refreshing pending items…</p>}
      {nothingPending && <Panel className="mb-5 text-center text-sm text-slate-500">Nothing pending.</Panel>}
      <div className="grid gap-5">
        <Panel>
          <h2 className="mb-4 font-display text-xl">Pending verification <Badge>{data.verification.total || 0}</Badge></h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Member', 'Member code', 'Tier', 'Submitted', 'Actions'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.verification.items.map((row) => <tr key={row._id}>
                  <td className="px-4 py-3.5 text-slate-700">{memberLink(row._id, row.profile?.fullName || row.user?.firstName || row.user?.email || 'Member')}</td>
                  <td className="px-4 py-3.5 text-slate-700">{formatMemberCode(row.memberCode)}</td>
                  <td className="px-4 py-3.5 text-slate-700">{row.plan?.name || row.plan?.title || '—'}</td>
                  <td className="px-4 py-3.5 text-slate-700">{formatDate(row.updatedAt || row.createdAt)}</td>
                  <td className="px-4 py-3.5"><div className="flex gap-2">
                    <Button disabled={busy} onClick={() => requestAction({ type: 'approve-verification', row })}>Approve</Button>
                    <Button variant="danger" disabled={busy} onClick={() => requestAction({ type: 'reject-verification', row })}>Reject</Button>
                  </div></td>
                </tr>)}
                {!data.verification.items.length && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="5">Nothing pending.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination info={data.verification} onPage={(page) => load({ ...pages, verification: page })} />
        </Panel>

        <Panel>
          <h2 className="mb-4 font-display text-xl">Pending payments <Badge>{data.payments.total || 0}</Badge></h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[950px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Member', 'Member code', 'Plan', 'Method', 'Amount', 'Reference', 'Date', 'Action'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.payments.items.map((row) => {
                  const detail = row.memberDetail;
                  const id = membershipId(row.membership);
                  return <tr key={row._id}>
                    <td className="px-4 py-3.5 text-slate-700">{memberLink(id, detail?.profile?.fullName || row.user?.firstName || row.user?.email || 'Member')}</td>
                    <td className="px-4 py-3.5 text-slate-700">{detail?.membership?.memberCode ? formatMemberCode(detail.membership.memberCode) : '—'}</td>
                    <td className="px-4 py-3.5 text-slate-700">{row.plan?.name || row.plan?.title || '—'}</td>
                    <td className="px-4 py-3.5"><Badge tone={row.status}>{row.method || '—'}</Badge></td>
                    <td className="px-4 py-3.5 text-slate-700">{formatINR(paymentAmount(row))}</td>
                    <td className="px-4 py-3.5 text-slate-700">{row.reference || row.utr || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-700">{formatDate(row.createdAt)}</td>
                    <td className="px-4 py-3.5"><Button disabled={busy} onClick={() => requestAction({ type: 'confirm-payment', row })}>Confirm</Button></td>
                  </tr>;
                })}
                {!data.payments.items.length && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="8">Nothing pending.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination info={data.payments} onPage={(page) => load({ ...pages, payments: page })} />
        </Panel>

        <Panel>
          <h2 className="mb-4 font-display text-xl">Pending family requests <Badge>{data.family.total || 0}</Badge></h2>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>{['Family member', 'Request', 'Member', 'Member code', 'Updated', 'Actions'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.family.items.map((row) => {
                  const membership = row.membership;
                  const id = membershipId(membership);
                  return <tr key={row._id}>
                    <td className="px-4 py-3.5 text-slate-700">{row.name || row.fullName || 'Family member'}</td>
                    <td className="px-4 py-3.5"><Badge>{String(row.pendingAction || 'request').replaceAll('_', ' ')}</Badge></td>
                    <td className="px-4 py-3.5 text-slate-700">{memberLink(id, membership?.user?.firstName || membership?.user?.email || 'Member')}</td>
                    <td className="px-4 py-3.5 text-slate-700">{membership?.memberCode ? formatMemberCode(membership.memberCode) : membership?.memberNumber || '—'}</td>
                    <td className="px-4 py-3.5 text-slate-700">{formatDate(row.updatedAt || row.createdAt)}</td>
                    <td className="px-4 py-3.5"><div className="flex gap-2">
                      <Button disabled={busy} onClick={() => requestAction({ type: 'approve-family', row })}>Approve</Button>
                      <Button variant="danger" disabled={busy} onClick={() => requestAction({ type: 'reject-family', row })}>Reject</Button>
                    </div></td>
                  </tr>;
                })}
                {!data.family.items.length && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="6">Nothing pending.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pagination info={data.family} onPage={(page) => load({ ...pages, family: page })} />
        </Panel>
      </div>
    </>}
    {confirmation && <ConfirmDialog
      title={{
        'approve-verification': 'Approve membership verification?',
        'reject-verification': 'Reject membership verification?',
        'confirm-payment': 'Confirm this payment?',
        'approve-family': 'Approve this family request?',
        'reject-family': 'Reject this family request?',
      }[confirmation.type]}
      confirmLabel="Confirm"
      busy={busy}
      onCancel={() => setConfirmation(null)}
      onConfirm={confirmAction}
    >
      {confirmation.type === 'confirm-payment'
        ? <p>Confirm payment for {confirmation.row.method || 'this method'}. Cheques must be cleared before confirmation.</p>
        : (confirmation.type === 'reject-verification' || confirmation.type === 'reject-family')
          ? <FormField label="Required rejection reason">
            <textarea className={controlClass} rows="3" maxLength="1000" required value={reason} onChange={(event) => setReason(event.target.value)} />
          </FormField>
          : <p>This action will be recorded for the selected membership.</p>}
    </ConfirmDialog>}
  </section>;
}
