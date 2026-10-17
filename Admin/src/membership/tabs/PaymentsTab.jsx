import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  FormField,
  LoadingState,
  Panel,
  Toast,
  controlClass,
  formatDate,
} from '../../components/ui.jsx';
import { downloadPaymentReceipt, membershipApi } from '../../api/membership.js';
import { formatINR } from '../formatters.js';

const methods = ['bank_transfer', 'cheque', 'rtgs'];
const blankPayment = { method: 'bank_transfer', amount: '', reference: '', paymentDate: '', note: '' };

function paymentAmount(payment) {
  return Number(payment.amount ?? Number(payment.totalAmount || 0) / 100);
}

function paymentStatus(status) {
  const label = String(status || 'unknown').replaceAll('_', ' ');
  return <Badge tone={label}>{label}</Badge>;
}

export default function PaymentsTab() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [paymentForm, setPaymentForm] = useState(blankPayment);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    setLoading(true);
    try {
      setData(await membershipApi.member(id));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function recordPayment(event) {
    event.preventDefault();
    setConfirmation({ type: 'record' });
  }

  async function confirmAction() {
    setBusy(true);
    setError('');
    try {
      if (confirmation.type === 'record') {
        const response = await membershipApi.recordPayment({
          membershipId: id,
          method: paymentForm.method,
          amount: Number(paymentForm.amount),
          reference: paymentForm.reference.trim(),
          paymentDate: paymentForm.paymentDate || undefined,
          note: paymentForm.note.trim(),
        });
        setNotice(`Offline payment recorded${response._id ? ` (${response._id})` : ''}.`);
        setFormOpen(false);
        setPaymentForm(blankPayment);
      } else {
        await membershipApi.confirmPayment(confirmation.payment._id);
        setNotice('Payment confirmed.');
      }
      setConfirmation(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function downloadReceipt(paymentId) {
    setDownloading(paymentId);
    setError('');
    try {
      await downloadPaymentReceipt(paymentId);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setDownloading('');
    }
  }

  const payments = data?.payments || [];
  const membership = data?.membership;
  const pendingPayment = payments.find((payment) => payment.status === 'pending');
  const planFeePaise = pendingPayment?.baseAmount ?? Number(membership?.plan?.price || 0) * 100;
  const gstEnabled = pendingPayment
    ? (pendingPayment.gstEnabled ?? pendingPayment.gstAmount > 0)
    : (data?.gstSettings?.enabled ?? true);
  const gstRate = pendingPayment?.gstRate ?? data?.gstSettings?.rate ?? 18;
  const gstAmountPaise = pendingPayment?.gstAmount
    ?? (gstEnabled ? Math.round(planFeePaise * gstRate / 100) : 0);
  const totalAmountPaise = pendingPayment?.totalAmount ?? planFeePaise + gstAmountPaise;

  if (loading && !data) return <LoadingState />;
  if (!data && error) {
    return <section className="grid gap-4">
      <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>
      <Button variant="secondary" onClick={load}>Retry</Button>
    </section>;
  }

  return <section className="grid gap-5">
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {loading && <p className="text-sm text-slate-500" role="status">Loading payments…</p>}
    <Panel>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Membership payments</h2>
          <p className="mt-1 text-sm text-slate-500">{payments.length} payment{payments.length === 1 ? '' : 's'}</p>
        </div>
        <Button
          disabled={membership?.status !== 'pending_payment' || busy}
          onClick={() => {
            setPaymentForm({ ...blankPayment, amount: String(totalAmountPaise / 100) });
            setFormOpen((open) => !open);
          }}
        >Record offline payment</Button>
      </div>
      {membership?.status !== 'pending_payment' && <p className="mb-4 text-sm text-slate-500">Offline payments can be recorded while the membership is awaiting payment.</p>}
      {payments.length
        ? <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>{['Date', 'Plan', 'Amount', 'Method', 'Status', 'Reference', ''].map((label) => <th key={label || 'action'} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((payment) => <tr key={payment._id}>
                <td className="px-4 py-3.5 text-slate-700">{formatDate(payment.paymentDate || payment.createdAt)}</td>
                <td className="px-4 py-3.5 text-slate-700">{payment.plan?.name || payment.plan?.title || membership.plan?.name || membership.plan?.title || '—'}</td>
                <td className="px-4 py-3.5 text-slate-700">{formatINR(paymentAmount(payment))}</td>
                <td className="px-4 py-3.5 text-slate-700">{payment.method === 'rtgs' ? 'RTGS' : String(payment.method || '').replaceAll('_', ' ') || '—'}</td>
                <td className="px-4 py-3.5">{paymentStatus(payment.status)}</td>
                <td className="px-4 py-3.5 text-slate-700">{payment.reference || payment.utr || payment.razorpayPaymentId || '—'}</td>
                <td className="px-4 py-3.5"><div className="flex flex-wrap gap-2">
                  {payment.status === 'pending' && methods.includes(payment.method)
                    ? <Button variant="secondary" disabled={busy} onClick={() => setConfirmation({ type: 'confirm', payment })}>Confirm payment</Button>
                    : null}
                  {payment.status === 'confirmed' && <Button
                    variant="secondary"
                    disabled={downloading === payment._id}
                    onClick={() => downloadReceipt(payment._id)}
                  >{downloading === payment._id ? 'Downloading…' : 'Download receipt'}</Button>}
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        : <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No payments recorded for this membership.</div>}
    </Panel>

    {formOpen && <Panel>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={recordPayment}>
        <h3 className="font-display text-lg sm:col-span-2">Record offline payment</h3>
        <FormField label="Method">
          <select className={controlClass} value={paymentForm.method} onChange={(event) => setPaymentForm({ ...paymentForm, method: event.target.value })}>
            {methods.map((method) => <option key={method} value={method}>{method === 'rtgs' ? 'RTGS' : method.replaceAll('_', ' ')}</option>)}
          </select>
        </FormField>
        <FormField label="Amount (₹)">
          <input className={controlClass} type="number" min="1" step="1" required value={paymentForm.amount} onChange={(event) => setPaymentForm({ ...paymentForm, amount: event.target.value })} />
        </FormField>
        <FormField label={paymentForm.method === 'cheque' ? 'Cheque number' : paymentForm.method === 'rtgs' ? 'RTGS UTR' : 'Bank reference'}>
          <input className={controlClass} maxLength="200" required value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} />
        </FormField>
        <FormField label="Payment date">
          <input className={controlClass} type="date" required={paymentForm.method === 'rtgs'} value={paymentForm.paymentDate} onChange={(event) => setPaymentForm({ ...paymentForm, paymentDate: event.target.value })} />
        </FormField>
        <FormField label="Note" className="sm:col-span-2">
          <textarea className={controlClass} rows="2" maxLength="500" value={paymentForm.note} onChange={(event) => setPaymentForm({ ...paymentForm, note: event.target.value })} />
        </FormField>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>Continue</Button>
          <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button>
        </div>
      </form>
    </Panel>}

    {confirmation && <ConfirmDialog
      title={confirmation.type === 'record' ? 'Record offline payment?' : 'Confirm offline payment?'}
      onCancel={() => setConfirmation(null)}
      onConfirm={confirmAction}
      confirmLabel={confirmation.type === 'record' ? 'Record payment' : 'Confirm payment'}
      busy={busy}
    >
      {confirmation.type === 'record'
        ? `Record ${formatINR(paymentForm.amount)} by ${paymentForm.method.replaceAll('_', ' ')}?`
        : <div className="grid gap-2">
          <p>Confirm receipt of {formatINR(paymentAmount(confirmation.payment))}.</p>
          {confirmation.payment.method === 'cheque' && <p className="font-semibold text-amber-800">Confirm only after the cheque has cleared.</p>}
        </div>}
    </ConfirmDialog>}
  </section>;
}
