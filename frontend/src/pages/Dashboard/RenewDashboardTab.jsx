import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuth from '../../context/useAuth.js';
import { getMyMembership } from './memberDashboardApi.js';
import {
  createMembershipUpgrade,
  createRenewalOrder,
  getMembershipBankDetails,
  getMembershipUpgradeQuote,
  getActiveMembershipPlans,
  loadRazorpayCheckout,
  startMembershipRenewal,
  verifyRenewalPayment,
} from './memberDashboardActionsApi.js';
import PlanCard from '../../components/PlanCard.jsx';
import { mapPlanToCard } from '../../lib/planCardData.js';

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const formatINR = (value) => `₹${numberFormat.format(Number(value) || 0)}`;
const formatPts = (value) => `${numberFormat.format(Number(value) || 0)} pts`;

function RenewalCard({ plan, selectedPlanId, onChoose, loading }) {
  return <article className="member-hub__bill-card">
    <h3>{plan.name}</h3>
    <p><strong>{formatINR(plan.price)}</strong></p>
    <p>{formatPts(plan.renewalPoints)} on renewal</p>
    <button
      className="member-hub__retry"
      type="button"
      disabled={loading}
      aria-pressed={String(selectedPlanId) === String(plan._id || plan.id)}
      onClick={() => onChoose(plan._id || plan.id)}
    >{String(selectedPlanId) === String(plan._id || plan.id) ? 'Selected' : 'Choose this tier'}</button>
  </article>;
}

export default function RenewDashboardTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [membership, setMembership] = useState(null);
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pendingPaymentId, setPendingPaymentId] = useState('');
  const [pendingPlanId, setPendingPlanId] = useState('');
  const [upgradeQuote, setUpgradeQuote] = useState(null);
  const [selectedUpgradePlanId, setSelectedUpgradePlanId] = useState('');
  const [upgradeError, setUpgradeError] = useState('');
  const [bankDetails, setBankDetails] = useState(null);

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
      const current = await getMyMembership();
      setMembership(current || null);
      if (current) {
        try {
          const quote = await getMembershipUpgradeQuote();
          setUpgradeQuote(quote);
          setUpgradeError('');
          setSelectedUpgradePlanId((previous) => (
            quote.plans?.some((plan) => String(plan._id) === String(previous) && plan.isUpgradeAllowed)
              ? previous
              : String(quote.plans?.find((plan) => plan.isUpgradeAllowed)?._id || '')
          ));
          if (quote.pendingUpgrade) {
            setBankDetails(await getMembershipBankDetails());
          } else {
            setBankDetails(null);
          }
        } catch (failure) {
          setUpgradeError(failure.message || 'Could not load upgrade options.');
        }
      } else {
        setUpgradeQuote(null);
        setBankDetails(null);
      }
      if (current?.canRenew) {
        const [activePlans, renewablePlans] = await Promise.all([
          getActiveMembershipPlans(),
          Promise.resolve(current.renewalPlans || []),
        ]);
        const active = Array.isArray(activePlans) ? activePlans : [];
        const renewableIds = new Set(renewablePlans.map((plan) => String(plan.id || plan._id)));
        const available = active
          .filter((plan) => renewableIds.has(String(plan._id || plan.id)))
          .sort((first, second) => Number(first.sortOrder || 0) - Number(second.sortOrder || 0));
        const currentTier = String(current.tier || '').trim().toLowerCase();
        const currentPlan = active.find((plan) => String(plan.name || plan.title || '').trim().toLowerCase() === currentTier);
        if (!currentPlan) {
          setPlans([]);
          setError('Your current tier could not be matched to the active renewal tiers. Please contact the club for assistance.');
        } else {
          const currentOrder = Number(currentPlan.sortOrder || 0);
          const eligible = available.filter((plan) => Number(plan.sortOrder || 0) >= currentOrder);
          setPlans(eligible);
          setSelectedPlanId((previous) => eligible.some((plan) => String(plan._id || plan.id) === String(previous))
            ? previous
            : String(eligible[0]?._id || eligible[0]?.id || ''));
        }
      } else {
        setPlans([]);
      }
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      if (failure.status === 404) {
        setMembership(null);
        setPlans([]);
        setError('');
      } else {
        setError(failure.message || 'Could not load renewal options.');
      }
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  async function openCheckout(paymentId, plan) {
    const order = await createRenewalOrder(paymentId);
    await loadRazorpayCheckout();
    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      name: 'Orianaa Club',
      description: `${plan.name} membership renewal`,
      order_id: order.orderId,
      handler: async (response) => {
        setProcessing(true);
        setError('');
        setMessage('');
        try {
          await verifyRenewalPayment(response);
          setPendingPaymentId('');
          setPendingPlanId('');
          setMessage('Payment verified. Your membership details are being refreshed.');
          await load();
        } catch (failure) {
          if (failure.status === 401) {
            await handleSessionExpired();
            return;
          }
          setError(failure.message || 'Payment was received but could not be verified yet. Please try again or contact the club.');
        } finally {
          setProcessing(false);
        }
      },
      modal: {
        ondismiss: () => {
          setProcessing(false);
          setMessage('Checkout was cancelled. You can reopen the payment securely when you are ready.');
        },
      },
    });
    checkout.on('payment.failed', () => {
      setProcessing(false);
      setError('Payment failed. Please check your details and reopen the payment to try again.');
    });
    checkout.open();
  }

  async function onRazorpay() {
    const plan = plans.find((item) => String(item._id || item.id) === String(selectedPlanId));
    if (!plan) {
      setError('Choose an available renewal tier first.');
      return;
    }
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      let paymentId = pendingPlanId === selectedPlanId ? pendingPaymentId : '';
      if (!paymentId) {
        const renewal = await startMembershipRenewal(selectedPlanId, 'razorpay');
        paymentId = renewal.paymentId;
        setPendingPaymentId(paymentId);
        setPendingPlanId(selectedPlanId);
      }
      await openCheckout(paymentId, plan);
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not start Razorpay checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  }

  async function onOfflineRenewal(event) {
    event.preventDefault();
    const plan = plans.find((item) => String(item._id || item.id) === String(selectedPlanId));
    if (!plan) {
      setError('Choose an available renewal tier first.');
      return;
    }
    if (!window.confirm(`Request renewal on ${plan.name} for ${formatINR(plan.price)} using ${paymentMethod.replaceAll('_', ' ')}? The renewal remains pending until an admin confirms payment.`)) return;
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      await startMembershipRenewal(selectedPlanId, paymentMethod);
      setMessage('Pending admin confirmation. Please contact the club with your Member ID and arrange payment using the selected method.');
      setPendingPaymentId('');
      setPendingPlanId('');
      await load();
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not submit your offline renewal request.');
    } finally {
      setProcessing(false);
    }
  }

  async function onCreateUpgrade() {
    if (!upgradeQuote?.eligibility || !selectedUpgradePlanId || upgradeQuote.pendingUpgrade) return;
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      const result = await createMembershipUpgrade(selectedUpgradePlanId);
      setMessage(`Upgrade payment for ${result.planName} is pending admin confirmation.`);
      await load();
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not create the upgrade payment.');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) return <section className="member-hub__panel" aria-labelledby="renew-dashboard-title">
    <h2 id="renew-dashboard-title">Renew</h2>
    <p className="member-hub__loading" role="status">Loading your renewal options…</p>
  </section>;

  return <section className="member-hub__panel" aria-labelledby="renew-dashboard-title">
    <h2 id="renew-dashboard-title">Renew</h2>
    {error && <div className="member-hub__error" role="alert">{error}</div>}
    {message && <div className="member-hub__warning" role="status">{message}</div>}
    {upgradeError && <div className="member-hub__error" role="alert">{upgradeError}</div>}
    {upgradeQuote && <>
      <div className="member-upgrade-summary" aria-label="Upgrade summary">
        <div><span>Current plan</span><strong>{upgradeQuote.currentPlan.name} · {formatINR(upgradeQuote.currentPlan.price)}</strong></div>
        <div><span>Points remaining</span><strong>{formatPts(upgradeQuote.pointsBalance)}</strong></div>
        <div><span>Member type</span><strong>{upgradeQuote.earlyBird ? 'Early bird x2' : 'Standard x1.6'}</strong></div>
        <div><span>Upgrade available</span><strong>{upgradeQuote.eligibility ? 'Yes' : 'No'}</strong></div>
      </div>
      {!upgradeQuote.eligibility && <div className="member-hub__warning" role="status">
        {upgradeQuote.eligibilityReason || 'Upgrade is available only while your membership is active and has not expired.'}
      </div>}
      {upgradeQuote.pendingUpgrade
        ? <div className="member-upgrade-pending" role="status">
          <h3>Upgrade payment pending</h3>
          <p>Plan: <strong>{upgradeQuote.pendingUpgrade.planName}</strong></p>
          <p>Amount including GST: <strong>{formatINR(upgradeQuote.pendingUpgrade.totalPayable)}</strong></p>
          <p>Points to be added after confirmation: <strong>{formatPts(upgradeQuote.pendingUpgrade.upgradePoints)}</strong></p>
          <h4>Bank transfer details</h4>
          {bankDetails
            ? <dl>
              <div><dt>Account name</dt><dd>{bankDetails.accountName || '—'}</dd></div>
              <div><dt>Bank</dt><dd>{bankDetails.bank || '—'}</dd></div>
              <div><dt>Account number</dt><dd>{bankDetails.accountNumber || '—'}</dd></div>
              <div><dt>IFSC</dt><dd>{bankDetails.ifsc || '—'}</dd></div>
              <div><dt>Branch</dt><dd>{bankDetails.branch || '—'}</dd></div>
            </dl>
            : <p>Bank transfer details are currently unavailable. Please contact the club.</p>}
          <p className="member-hub__subtle">Your plan and points update after the admin confirms your transfer.</p>
        </div>
        : <div className="member-upgrade-section">
          <h3>Upgrade your plan</h3>
          <div className="member-upgrade-grid">
            {upgradeQuote.plans.map((plan, index) => {
              const isSelected = String(selectedUpgradePlanId) === String(plan._id);
              const cardPlan = mapPlanToCard({
                ...plan,
                title: plan.title || plan.name,
                benefitsTitle: plan.name,
                subtitle: plan.subtitle || '25 year membership',
                price: plan.price,
              });
              return <PlanCard
                key={`${plan.planModel || 'MembershipPlan'}-${plan._id}`}
                plan={cardPlan}
                index={index}
                visible
                current={plan.isCurrent}
                selected={isSelected}
                upgradeSelected={isSelected}
                disabled={!plan.isCurrent && (!plan.isUpgradeAllowed || Boolean(upgradeQuote.pendingUpgrade))}
                buttonLabel={plan.baseDifference > 0 ? 'Select' : 'Not available'}
                onSelect={() => setSelectedUpgradePlanId(String(plan._id))}
                details={plan.baseDifference > 0 ? <div className="member-upgrade-card-details">
                  <p>Pay Rs {numberFormat.format(plan.baseDifference)} + GST</p>
                  <p>You get +{formatPts(plan.upgradePoints)}</p>
                </div> : null}
              />;
            })}
          </div>
          {(() => {
            const selectedPlan = upgradeQuote.plans.find((plan) => String(plan._id) === String(selectedUpgradePlanId));
            if (!selectedPlan?.isUpgradeAllowed) return null;
            return <>
              <div className="member-upgrade-breakdown">
                <section>
                  <h4>You pay</h4>
                  <p>Price difference <strong>{formatINR(selectedPlan.baseDifference)}</strong></p>
                  <p>GST ({upgradeQuote.gst.rate}%) <strong>{formatINR(selectedPlan.gstAmount)}</strong></p>
                  <p>Total to pay <strong>{formatINR(selectedPlan.totalPayable)}</strong></p>
                </section>
                <section>
                  <h4>Points (base amount only)</h4>
                  <p>{formatINR(selectedPlan.baseDifference)} x {upgradeQuote.multiplier} = <strong>{formatPts(selectedPlan.upgradePoints)}</strong></p>
                  <p>Current balance <strong>{formatPts(upgradeQuote.pointsBalance)}</strong></p>
                  <p>New balance <strong>{formatPts(selectedPlan.newBalance)}</strong></p>
                </section>
              </div>
              <button
                className="member-hub__retry"
                type="button"
                disabled={processing || !upgradeQuote.eligibility || Boolean(upgradeQuote.pendingUpgrade)}
                onClick={onCreateUpgrade}
              >{processing ? 'Creating upgrade payment…' : `Upgrade to ${selectedPlan.name}`}</button>
            </>;
          })()}
        </div>}
    </>}
    {!membership
      ? <div className="member-hub__empty">
        <p>No existing membership was found for renewal.</p>
        <Link to="/luxury-membership">Explore membership plans</Link>
      </div>
      : !membership.canRenew
        ? <div className="member-hub__warning">
          <p>Renewal is not available yet. It will become available when your membership is eligible.</p>
          {membership.status === 'active' && <p>Points remaining: <strong>{formatPts(membership.pointsBalance)}</strong></p>}
          <p>Membership status: <strong>{String(membership.status || 'unknown').replaceAll('_', ' ')}</strong></p>
        </div>
        : <>
          <p className="member-hub__subtle">Choose the same or a higher tier than your current membership ({membership.tier || 'current tier'}).</p>
          {plans.length === 0 && !error
            ? <p className="member-hub__empty">No active renewal tiers are available right now.</p>
            : <div className="member-hub__cards" style={{ display: 'grid', gap: 12 }}>
              {plans.map((plan) => <RenewalCard
                key={plan._id || plan.id}
                plan={plan}
                selectedPlanId={selectedPlanId}
                onChoose={setSelectedPlanId}
                loading={processing}
              />)}
            </div>}
          {plans.length > 0 && <div>
            <h3>Razorpay</h3>
            <button className="member-hub__retry" type="button" disabled={processing || !selectedPlanId} onClick={onRazorpay}>
              {processing ? 'Opening secure checkout…' : pendingPaymentId && pendingPlanId === selectedPlanId
                ? 'Reopen Razorpay checkout'
                : 'Pay securely with Razorpay'}
            </button>
            <h3>Offline payment</h3>
            <form className="member-hub__filters" onSubmit={onOfflineRenewal}>
              <label>Payment method
                <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </label>
              <button className="member-hub__retry" type="submit" disabled={processing || !selectedPlanId}>
                {processing ? 'Submitting…' : 'Request offline renewal'}
              </button>
            </form>
            <p className="member-hub__subtle">Offline renewals remain pending until an admin confirms payment. Contact the club with your Member ID and payment reference.</p>
          </div>}
        </>}
    <button className="member-hub__retry" type="button" onClick={load} disabled={processing}>Refresh renewal status</button>
  </section>;
}
