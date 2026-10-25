import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../lib/apiClient.js';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';
import { downloadMyPaymentReceipt, getMyPayments } from './memberDashboardApi.js';
import './PaymentsReceiptsTab.css';

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
};
const formatINR = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
}).format(Number(value || 0) / 100);
const statusInfo = (status) => {
  if (status === 'confirmed') return { label: 'Confirmed', className: 'is-confirmed' };
  if (['failed', 'rejected', 'refunded', 'partially_refunded'].includes(status)) {
    return { label: 'Failed', className: 'is-failed' };
  }
  return { label: 'Pending admin confirmation', className: 'is-pending' };
};

export default function PaymentsReceiptsTab({ onSessionExpired }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState('');

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      setPayments(await getMyPayments());
    } catch (failure) {
      if (!silent) {
        if (failure.status === 401) onSessionExpired();
        setError(failure.message || 'Could not load your payments.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onSessionExpired]);

  useAutoRefresh(() => load({ silent: true }));

  useEffect(() => {
    load();
  }, [load]);

  async function download(payment) {
    setDownloading(payment._id);
    setError('');
    try {
      await downloadMyPaymentReceipt(payment._id);
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.status === 401) onSessionExpired();
      setError(failure.message || 'Could not download the receipt.');
    } finally {
      setDownloading('');
    }
  }

  return <section className="member-hub__panel">
    <h2>Payments &amp; Receipts</h2>
    {loading && <p className="member-hub__loading" role="status">Loading your payments…</p>}
    {error && <div className="member-hub__error" role="alert">
      <p>{error}</p>
      <button className="member-hub__retry" type="button" onClick={load}>Try again</button>
    </div>}
    {!loading && !error && !payments.length && (
      <div className="member-hub__empty">No payments yet</div>
    )}
    {!loading && payments.length > 0 && <div className="member-hub-receipts">
      {payments.map((payment) => {
        const status = statusInfo(payment.status);
        const confirmed = payment.status === 'confirmed';
        return <article className="member-hub-receipt" key={payment._id}>
          <div className="member-hub-receipt__heading">
            <h3>{payment.plan?.name || payment.plan?.title || 'Membership payment'}</h3>
            <span className={`member-hub-receipt__status ${status.className}`}>{status.label}</span>
          </div>
          <dl>
            <div><dt>Date</dt><dd>{formatDate(payment.confirmedAt || payment.createdAt)}</dd></div>
            <div><dt>Plan fee</dt><dd>{formatINR(payment.baseAmount ?? Number(payment.amount || 0) * 100)}</dd></div>
            <div>
              <dt>{payment.gstLabel || 'GST'} ({payment.gstRate ?? (
                payment.baseAmount ? Math.round((payment.gstAmount / payment.baseAmount) * 10000) / 100 : 0
              )}%)</dt>
              <dd>{formatINR(payment.gstAmount)}</dd>
            </div>
            <div><dt>Total</dt><dd>{formatINR(payment.totalAmount ?? Number(payment.amount || 0) * 100)}</dd></div>
            <div><dt>Method</dt><dd>{String(payment.method || '—').replaceAll('_', ' ')}</dd></div>
            <div><dt>Reference</dt><dd>{payment.reference || payment.utr || payment.razorpayPaymentId || '—'}</dd></div>
          </dl>
          {confirmed
            ? <div className="member-hub-receipt__action">
              <span className="member-hub-receipt__number">{payment.invoiceNumber || payment.receiptNumber || 'GST invoice ready'}</span>
              <button
                className="member-hub__retry"
                type="button"
                disabled={downloading === payment._id}
                onClick={() => download(payment)}
              >{downloading === payment._id ? 'Downloading…' : 'Download GST invoice'}</button>
            </div>
            : <button className="member-hub__retry" type="button" disabled>
              Available after admin confirmation
            </button>}
        </article>;
      })}
    </div>}
  </section>;
}
