import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../../context/useAuth.js';
import {
  confirmFamilyCheckoutPayment,
  createFamilyCheckoutOrder,
  getFamilyCheckoutQuote,
  startFamilyCheckout,
} from '../../lib/familyMembershipApi.js';
import { loadRazorpayCheckout } from './memberDashboardActionsApi.js';
import './FamilyVerificationPage.css';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const formatINR = (amount) => `₹${numberFormat.format(Number(amount) || 0)}`;

export default function FamilyCheckoutPage() {
  const { familyId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);

  const handleSessionExpired = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }, [logout, navigate]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setQuote(await getFamilyCheckoutQuote(familyId));
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not load the approved family rate.');
    } finally {
      setLoading(false);
    }
  }, [familyId, handleSessionExpired]);

  useEffect(() => { load(); }, [load]);

  async function pay() {
    if (inFlight.current || !quote) return;
    inFlight.current = true;
    setProcessing(true);
    setError('');
    try {
      const payment = await startFamilyCheckout(familyId);
      if (!payment.paymentId) throw new Error('The family payment could not be prepared.');
      const order = await createFamilyCheckoutOrder(familyId);
      await loadRazorpayCheckout();
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'Orianaa Club',
        description: `${quote.name || 'Family member'} membership`,
        order_id: order.orderId,
        handler: async (response) => {
          setError('');
          try {
            await confirmFamilyCheckoutPayment(familyId, response);
            setSuccess(true);
          } catch (failure) {
            if (failure.status === 401) {
              await handleSessionExpired();
              return;
            }
            setError(failure.message || 'Payment was received but could not yet be confirmed. Please retry or contact the club.');
          } finally {
            inFlight.current = false;
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            inFlight.current = false;
            setProcessing(false);
          },
        },
      });
      checkout.on('payment.failed', () => {
        inFlight.current = false;
        setProcessing(false);
        setError('Payment failed. Your family profile is saved; you can safely try again.');
      });
      checkout.open();
    } catch (failure) {
      inFlight.current = false;
      setProcessing(false);
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not open secure family checkout. Please try again.');
    }
  }

  return <main className="family-verify">
    <div className="family-verify__inner">
      <Link className="family-verify__back" to={`/dashboard/family/${encodeURIComponent(familyId)}/verification`}>← Back to verification</Link>
      <p className="family-verify__eyebrow">ORI A N A A  C L U B · FAMILY</p>
      <h1>Family membership payment</h1>
      <p className="family-verify__intro">This payment is for the verified family profile only.</p>
      {loading && <p className="family-verify__loading" role="status">Loading the approved family rate…</p>}
      {error && <div className="family-verify__alert" role="alert">{error}</div>}
      {success ? <section className="family-verify__card" aria-labelledby="family-payment-success">
        <p className="family-verify__eyebrow">Payment received</p>
        <h2 id="family-payment-success">Payment verified</h2>
        <p>The family membership payment was confirmed. It is now waiting for membership approval.</p>
        <Link className="family-verify__secondary-link" to="/dashboard?tab=Family">Return to Family</Link>
      </section> : quote && <section className="family-verify__card" aria-labelledby="family-payment-summary">
        <h2 id="family-payment-summary">{quote.name || 'Family member'}</h2>
        <dl className="family-verify__price">
          <div><dt>Discounted base</dt><dd>{formatINR(quote.baseAmount)}</dd></div>
          <div><dt>GST</dt><dd>{formatINR(quote.gstAmount)}</dd></div>
          <div className="family-verify__price-total"><dt>Total payable</dt><dd>{formatINR(quote.totalPayable)}</dd></div>
        </dl>
        <p className="family-verify__notice">
          Payment is non-refundable. The amount is calculated by the server from the approved family rate and configured GST.
        </p>
        <button className="family-verify__button" type="button" disabled={processing || loading} onClick={pay}>
          {processing ? 'Opening secure payment…' : `Pay ${formatINR(quote.totalPayable)}`}
        </button>
        {error && <p className="family-verify__subtle">Your payment order is safely tied to this family profile; retrying will not create a second charge.</p>}
      </section>}
      {!loading && !quote && error && <button className="family-verify__secondary" type="button" onClick={load}>Try again</button>}
    </div>
  </main>;
}
