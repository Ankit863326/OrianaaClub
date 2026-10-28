// This page reviews payments, approves or rejects bank transfers, and issues refunds.
import { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { adminApi, downloadCsv } from '../api/admin.js';
import { getImageUrl } from '../api/image.js';
import { DataTable, FormField, LoadingState, PageHeading, Pagination, Panel, Toast, Button, controlClass, formatPaise, formatDate } from '../components/ui.jsx';

const statuses = ['created', 'pending', 'pending_verification', 'confirmed', 'paid', 'failed', 'rejected', 'refunded', 'partially_refunded'];
const initialFilters = { page: 1, limit: 20, status: '', method: '', from: '', to: '' };

function paymentErrorMessage(error) {
  if ((error.response?.status ?? 0) >= 500) {
    return 'Payments could not be loaded or updated right now. Please try again shortly.';
  }
  return error.response?.data?.message || 'The payment request could not be completed. Please try again.';
}

export default function PaymentsPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [action, setAction] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('');
  const [reversePoints, setReversePoints] = useState(false);
  const [offlinePayment, setOfflinePayment] = useState({ amount: '', reference: '', paymentDate: '', note: '', method: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const proofUrl = selected?.proofUrl ? getImageUrl(selected.proofUrl) : '';
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    adminApi.payments(filters).then((result) => { if (active) setData(result); })
      .catch((failure) => { if (active) setError(paymentErrorMessage(failure)); });
    return () => { active = false; };
  }, [filters]);
  async function openDetails(row) {
    try { setSelected(await adminApi.payment(row._id)); }
    catch (failure) { setError(paymentErrorMessage(failure)); }
  }
  async function runAction(event) {
    event.preventDefault();
    try {
      if (action === 'confirm-offline') {
        await adminApi.recordOfflinePayment({
          membershipId: selected.membership?._id || selected.membership,
          method: selected.method,
          amount: Number(offlinePayment.amount),
          reference: offlinePayment.reference,
          paymentDate: offlinePayment.paymentDate || undefined,
          note: offlinePayment.note,
        });
        await adminApi.confirmOfflinePayment(selected._id);
        setAction('');
        setOfflinePayment({ amount: '', reference: '', paymentDate: '', note: '', method: '' });
        setNotice('Offline payment recorded and membership confirmation submitted.');
        const fresh = await adminApi.payment(selected._id);
        setSelected(fresh);
        setFilters({ ...filters });
        return;
      }
      if (action === 'approve-membership-verification') {
        await adminApi.approveMembershipVerification(selected.membership._id);
        setAction('');
        setNotice('Membership verification approved and membership is now active.');
        setSelected(await adminApi.payment(selected._id));
        setFilters({ ...filters });
        return;
      }
      const body = action === 'reject' ? { reason }
        : action === 'refund' ? { amount: Math.round(Number(amount) * 100), reason, reversePoints }
          : {};
      await adminApi.paymentAction(selected._id, action, body);
      setAction(''); setReason(''); setNotice('Payment action completed.');
      const fresh = await adminApi.payment(selected._id);
      setSelected(fresh);
      setFilters({ ...filters });
    } catch (failure) { setError(paymentErrorMessage(failure)); }
  }
  const downloadPayments = () => downloadCsv('/admin/payments/export', filters)
    .catch((failure) => setError(paymentErrorMessage(failure)));
  const columns = [
    { key: 'createdAt', label: 'Date', render: (row) => formatDate(row.createdAt) },
    { key: 'user', label: 'Member', render: (row) => row.user?.firstName || '—' },
    { key: 'plan', label: 'Plan', render: (row) => row.plan?.title || row.plan?.name || '—' },
    { key: 'method', label: 'Method', render: (row) => row.method === 'rtgs' ? 'RTGS' : row.method },
    { key: 'references', label: 'Reference status', render: (row) => row.brokenReferences?.length
      ? <span className="text-sm text-red-700" title={`Missing ${row.brokenReferences.join(', ')} reference`}>
        Missing {row.brokenReferences.join(', ')}
      </span>
      : '—' },
    { key: 'status', label: 'Status' },
    { key: 'totalAmount', label: 'Total', render: (row) => formatPaise(row.totalAmount) },
    { key: 'details', label: '', render: (row) => <Button variant="secondary" onClick={() => openDetails(row)}>Review</Button> },
  ];
  return <section>
    <PageHeading eyebrow="COLLECTIONS" title="Payments" description="Review bank-transfer proofs and track payment decisions." actions={<Button variant="secondary" onClick={downloadPayments}>Export CSV</Button>} />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}{notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <select className={controlClass} aria-label="Filter status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
      <select className={controlClass} aria-label="Filter method" value={filters.method} onChange={(event) => setFilters({ ...filters, method: event.target.value, page: 1 })}><option value="">All methods</option><option value="razorpay">Razorpay</option><option value="bank_transfer">Bank transfer</option><option value="netbanking">Netbanking</option><option value="cheque">Cheque</option><option value="rtgs">RTGS</option><option value="cash">Cash</option><option value="manual">Manual</option></select>
      <input className={controlClass} type="date" aria-label="From date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value, page: 1 })} />
      <input className={controlClass} type="date" aria-label="To date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value, page: 1 })} />
    </div>
    {!data && !error && <LoadingState />}
    {data && <><DataTable columns={columns} rows={data.items} empty="No payment records match these filters." /><Pagination info={data} onPage={(page) => setFilters({ ...filters, page })} /></>}
    {selected && <div className="fixed inset-0 z-40 bg-midnight/40" onClick={() => setSelected(null)} role="presentation"><aside className="absolute inset-y-0 right-0 w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label="Payment details">
      <button className="float-right text-sm font-semibold text-forest" onClick={() => setSelected(null)}>Close ×</button>
      <p className="mb-1 text-xs font-bold uppercase tracking-widest text-gold">Payment review</p><h2 className="font-display text-2xl">{selected.user?.firstName || 'Member'} · {selected.plan?.title || selected.plan?.name}</h2>
      <p className="my-2 text-sm text-slate-500">{selected.status} · {selected.method === 'rtgs' ? 'RTGS' : selected.method}</p>
      {selected.brokenReferences?.length > 0 && <p className="my-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        Some linked records are unavailable: {selected.brokenReferences.join(', ')}. Payment details remain available for review.
      </p>}
      <Panel className="my-4 grid gap-2 text-sm">
        <p>Plan fee {formatPaise(selected.baseAmount)}</p>
        {(selected.gstEnabled ?? selected.gstAmount > 0) && <p>
          {selected.gstLabel || 'GST'} ({selected.gstRate ?? (
            selected.baseAmount ? Math.round((selected.gstAmount / selected.baseAmount) * 10000) / 100 : 0
          )}%) {formatPaise(selected.gstAmount)}
        </p>}
        <p>Total <strong>{formatPaise(selected.totalAmount)}</strong></p>
        <p>Invoice: {selected.invoiceNumber || '—'} · UTR: {selected.utr || '—'}</p>
      </Panel>
      {selected.proofUrl && <><a className="inline-flex items-center gap-2 font-semibold text-forest underline" href={proofUrl} target="_blank" rel="noreferrer">View transfer proof <ExternalLink size={15} /></a>{selected.proofUrl.match(/\.(jpg|jpeg|png|webp)$/i) && <img className="mt-3 max-h-72 w-full rounded-xl border border-slate-200 object-contain" src={proofUrl} alt="Uploaded bank-transfer proof" />}</>}
      {selected.membership?.status === 'pending_verification' && <section className="my-5" aria-label="Membership eligibility verification">
        <h3 className="font-semibold text-midnight">Membership verification documents</h3>
        {selected.membership.verificationDocs?.length ? selected.membership.verificationDocs.map((document, index) => {
          const documentUrl = getImageUrl(document.url);
          return <a key={`${document.url}-${index}`} className="mt-2 block font-semibold text-forest underline" href={documentUrl} target="_blank" rel="noreferrer">View verification document {index + 1} <ExternalLink size={15} className="inline" /></a>;
        }) : <p className="mt-2 text-sm text-slate-600">The member has not uploaded proof yet.</p>}
      </section>}
      <div className="mt-5 flex flex-wrap gap-2">
        {selected.status === 'pending' && selected.membership && selected.plan
          && ['bank_transfer', 'netbanking', 'cheque', 'cash', 'manual'].includes(selected.method)
          && <Button onClick={() => {
            setOfflinePayment({
              amount: String((selected.totalAmount ?? selected.amount * 100) / 100),
              reference: selected.reference || '',
              paymentDate: selected.transferDate ? new Date(selected.transferDate).toISOString().slice(0, 10) : '',
              note: selected.note || '',
              method: selected.method,
            });
            setAction('confirm-offline');
          }}>Record & confirm offline payment</Button>}
        {selected.membership?.status === 'pending_verification'
          && selected.membership.verificationDocs?.length > 0
          && <Button onClick={() => setAction('approve-membership-verification')}>Approve membership verification</Button>}
        {((selected.method === 'bank_transfer' && selected.status === 'pending_verification')
          || (selected.method === 'rtgs' && selected.status === 'pending')) && <><Button onClick={() => setAction('approve')}>Approve transfer</Button><Button variant="danger" onClick={() => setAction('reject')}>Reject transfer</Button></>}
        {selected.method === 'razorpay' && ['paid', 'partially_refunded'].includes(selected.status) && <Button onClick={() => setAction('refund')}>Refund</Button>}
      </div>
    </aside></div>}
    {action && <PaymentActionForm action={action} reason={reason} setReason={setReason} amount={amount} setAmount={setAmount} reversePoints={reversePoints} setReversePoints={setReversePoints} offlinePayment={offlinePayment} setOfflinePayment={setOfflinePayment} onCancel={() => setAction('')} onSubmit={runAction} />}
  </section>;
}

function PaymentActionForm({ action, reason, setReason, amount, setAmount, reversePoints, setReversePoints, offlinePayment, setOfflinePayment, onCancel, onSubmit }) {
  return <div className="fixed inset-0 z-[60] grid place-items-center bg-midnight/55 p-4"><form className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onSubmit={onSubmit}>
    <h2 className="mb-4 font-display text-2xl">{action === 'confirm-offline' ? 'Record offline payment?' : action === 'approve-membership-verification' ? 'Approve membership verification?' : action === 'approve' ? 'Approve transfer?' : action === 'reject' ? 'Reject transfer?' : 'Refund payment?'}</h2>
    {action === 'confirm-offline' && <>
      <FormField label="Amount (INR)"><input className={controlClass} type="number" min="0.01" step="0.01" required value={offlinePayment.amount} onChange={(event) => setOfflinePayment({ ...offlinePayment, amount: event.target.value })} /></FormField>
      <FormField label={['bank_transfer', 'netbanking', 'cheque', 'rtgs'].includes(offlinePayment.method) ? 'Bank reference / cheque number / UTR (if available)' : 'Reference'}><input className={controlClass} required={['bank_transfer', 'rtgs'].includes(offlinePayment.method)} value={offlinePayment.reference} onChange={(event) => setOfflinePayment({ ...offlinePayment, reference: event.target.value })} /></FormField>
      <FormField label="Payment date"><input className={controlClass} type="date" value={offlinePayment.paymentDate} onChange={(event) => setOfflinePayment({ ...offlinePayment, paymentDate: event.target.value })} /></FormField>
      <FormField label="Note"><textarea className={controlClass} value={offlinePayment.note} onChange={(event) => setOfflinePayment({ ...offlinePayment, note: event.target.value })} /></FormField>
      <p className="my-3 text-sm text-slate-600">Confirm only after funds have been received and any cheque has cleared.</p>
    </>}
    {action === 'approve' && <p className="mb-4 text-sm text-slate-600">Confirm that this bank transfer has been received and verified.</p>}
    {action === 'approve-membership-verification' && <p className="mb-4 text-sm text-slate-600">Confirm that the uploaded eligibility proof has been reviewed.</p>}
    {!['approve', 'approve-membership-verification', 'confirm-offline'].includes(action) && <FormField label="Reason"><textarea className={controlClass} required value={reason} onChange={(event) => setReason(event.target.value)} /></FormField>}
    {action === 'refund' && <><FormField label="Refund amount (INR)"><input className={controlClass} type="number" min="0.01" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} /></FormField><label className="my-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={reversePoints} onChange={(event) => setReversePoints(event.target.checked)} />Reverse awarded points</label></>}
    <div className="mt-5 flex justify-end gap-2"><Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button><Button type="submit" variant={action === 'reject' ? 'danger' : 'primary'}>{action === 'approve-membership-verification' ? 'Approve membership' : action}</Button></div>
  </form></div>;
}
