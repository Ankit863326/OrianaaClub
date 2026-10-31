import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import useAuth from '../../context/useAuth.js';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';
import {
  ApiClientError,
} from '../../lib/apiClient.js';
import {
  getMyMembership,
  getMyMembershipQr,
  getMyPointsHistory,
  getMyRedemptions,
} from './memberDashboardApi.js';
import FamilyDashboardTab from './FamilyDashboardTab.jsx';
import PaymentsReceiptsTab from './PaymentsReceiptsTab.jsx';
import RenewDashboardTab from './RenewDashboardTab.jsx';
import ReviewTab from './ReviewTab.jsx';
import { getIdentityVerification, submitIdentityVerification } from '../../lib/memberApi.js';
import { isValidIdentityNumber } from '../../lib/identityValidation.js';
import './MemberDashboard.css';

const tabs = ['Overview', 'Family', 'Documents', 'Bills & Bookings', 'Points History', 'Renew', 'Payments & Receipts', 'Review'];
const rowsPerPage = 10;
const emptyFilters = { from: '', to: '', status: '' };

const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const formatPts = (value) => `${numberFormat.format(Number(value) || 0)} pts`;
const formatINR = (value) => `₹${numberFormat.format(Number(value) || 0)}`;
const formatDate = (value, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', withTime
    ? { dateStyle: 'medium', timeStyle: 'short' }
    : { dateStyle: 'medium' }).format(date);
};
const formatValidityDate = (value) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
};
const formatValidityYears = (years) => {
  const value = Number(years);
  return Number.isSafeInteger(value) && value > 0 ? `${value} ${value === 1 ? 'year' : 'years'}` : '';
};
const formatMemberCode = (code) => {
  const value = String(code || '').trim().toUpperCase();
  return /^OC-\d{12,}(?:-(?:S|C\d+|F|M|SF|SM))?$/.test(value) ? value : '—';
};

function ErrorMessage({ message, retry }) {
  return <div className="member-hub__error" role="alert">
    <p>{message}</p>
    {retry && <button className="member-hub__retry" type="button" onClick={retry}>Try again</button>}
  </div>;
}

function EmptyState({ children }) {
  return <div className="member-hub__empty">{children}</div>;
}

function PaginationControls({ data, page, onPage, loading }) {
  if (!data || data.pages <= 1) return null;
  return <div className="member-hub__pagination">
    <span>{numberFormat.format(data.total || 0)} records</span>
    <button type="button" disabled={loading || page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
    <span>Page {page} of {data.pages}</span>
    <button type="button" disabled={loading || page >= data.pages} onClick={() => onPage(page + 1)}>Next</button>
  </div>;
}

function IdentityDocumentsPanel() {
  const [record, setRecord] = useState(null);
  const [idType, setIdType] = useState('aadhaar');
  const [panNumber, setPanNumber] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [files, setFiles] = useState({ panFront: null, secondFront: null, secondBack: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const inputRefs = useRef({});
  const [previewUrls, setPreviewUrls] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecord(await getIdentityVerification());
    } catch (failure) {
      setError(failure.message || 'Could not load identity verification status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const urls = Object.fromEntries(Object.entries(files)
      .filter(([, file]) => file)
      .map(([key, file]) => [key, URL.createObjectURL(file)]));
    setPreviewUrls(urls);
    return () => Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function chooseFile(key, event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (file && !['image/jpeg', 'image/png', 'application/pdf'].includes(file.type)) {
      setError('Identity files must be JPG, PNG, or PDF.');
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError('Each identity file must be 5 MB or smaller.');
      return;
    }
    setError('');
    setFiles((current) => ({ ...current, [key]: file }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!isValidIdentityNumber('pan', panNumber)
      || !isValidIdentityNumber(idType, idNumber)
      || Object.values(files).some((file) => !file)) {
      setError('Enter valid PAN and second ID numbers, then upload all three required files.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      setRecord(await submitIdentityVerification({
        panNumber,
        secondIdType: idType,
        secondIdNumber: idNumber,
        consent: true,
      }, files));
      setPanNumber('');
      setIdNumber('');
      setFiles({ panFront: null, secondFront: null, secondBack: null });
      setNotice('Your documents were submitted for review.');
    } catch (failure) {
      setError(failure.message || 'Could not submit identity documents.');
    } finally {
      setSaving(false);
    }
  }

  const needsUpload = !record || ['not_submitted', 'rejected'].includes(record.status);
  return <section className="member-hub__panel">
    <h2>Document verification</h2>
    {loading ? <p className="member-hub__loading" role="status">Loading your document status…</p> : <>
      {error && <ErrorMessage message={error} />}
      {notice && <p className="member-hub__warning" role="status">{notice}</p>}
      {record && <div className="member-hub__membership">
        <p><strong>Status:</strong> {String(record.status).replaceAll('_', ' ')}</p>
        {record.panMask && <p><strong>PAN:</strong> {record.panMask}</p>}
        {record.idMask && <p><strong>{record.idType.replaceAll('_', ' ')}:</strong> {record.idMask}</p>}
        {record.rejectionReason && <p className="member-hub__warning"><strong>Reason:</strong> {record.rejectionReason}</p>}
      </div>}
      {needsUpload ? <form className="mt-5 grid gap-4" onSubmit={submit}>
        <label className="member-hub__filter">PAN number
          <input value={panNumber} maxLength="10" autoCapitalize="characters" required onChange={(event) => setPanNumber(event.target.value.toUpperCase())} />
        </label>
        <label className="member-hub__filter">Second ID type
          <select value={idType} onChange={(event) => { setIdType(event.target.value); setIdNumber(''); setFiles((current) => ({ ...current, secondFront: null, secondBack: null })); }}>
            <option value="aadhaar">Aadhaar Card</option>
            <option value="driving_licence">Driving Licence</option>
            <option value="passport">Passport</option>
          </select>
        </label>
        <label className="member-hub__filter">Document number
          <input value={idNumber} maxLength="30" autoCapitalize="characters" required onChange={(event) => setIdNumber(event.target.value.toUpperCase())} />
        </label>
        {[
          ['panFront', 'PAN card front'],
          ['secondFront', `${idType.replaceAll('_', ' ')} front`],
          ['secondBack', `${idType.replaceAll('_', ' ')} back`],
        ].map(([key, label]) => <label className="member-hub__filter" key={key}>{label} (JPG, PNG, or PDF; max 5 MB)
          <input ref={(element) => { inputRefs.current[key] = element; }} className={files[key] ? 'sr-only' : ''} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" required={!files[key]} onChange={(event) => chooseFile(key, event)} />
          {files[key] && <span className="member-hub__subtle">
            {previewUrls[key] && (files[key].type.startsWith('image/')
              ? <img className="my-2 block size-20 rounded-lg border object-cover" src={previewUrls[key]} alt={`${label} preview`} />
              : <iframe className="my-2 block h-24 w-36 rounded-lg border" src={previewUrls[key]} title={`${label} preview`} />)}
            {files[key].name}{' '}
            <button className="member-hub__retry" type="button" onClick={() => inputRefs.current[key]?.click()}>Replace</button>{' '}
            <button className="member-hub__retry" type="button" onClick={() => setFiles((current) => ({ ...current, [key]: null }))}>Remove</button>
          </span>}
        </label>)}
        <p className="member-hub__subtle">I consent to Orianaa Club storing my identity documents for membership verification.</p>
        <button className="member-hub__retry" type="submit" disabled={saving}>{saving ? 'Submitting…' : 'Submit documents'}</button>
      </form> : <p className="member-hub__subtle">Your identity documents have already been submitted. Full document numbers are not shown.</p>}
    </>}
  </section>;
}

function StatusChip({ status }) {
  const normalized = String(status || 'unknown').toLowerCase().replaceAll(' ', '_');
  return <span className={`member-hub__status member-hub__status--${normalized}`}>
    {String(status || 'unknown').replaceAll('_', ' ')}
  </span>;
}

function BillsTab({ membership, onSessionExpired }) {
  const [filters, setFilters] = useState(emptyFilters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = page, nextFilters = filters, { silent = false } = {}) => {
    if (!membership) {
      setData({ items: [], page: 1, pages: 0, total: 0 });
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await getMyRedemptions({
        page: nextPage,
        limit: rowsPerPage,
        from: nextFilters.from,
        to: nextFilters.to,
        status: nextFilters.status,
      });
      setData(result);
      if (!silent) {
        setPage(nextPage);
        setFilters(nextFilters);
      }
    } catch (failure) {
      if (!silent) {
        if (failure.status === 401) onSessionExpired();
        setError(failure.message || 'Could not load your bills and bookings.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [filters, membership, onSessionExpired, page]);

  useAutoRefresh(() => load(page, filters, { silent: true }), { enabled: Boolean(membership) });

  useEffect(() => {
    load(1, emptyFilters);
  }, [membership?._id]);

  function setFilter(key, value) {
    const nextFilters = { ...filters, [key]: value };
    setFilters(nextFilters);
    setPage(1);
  }

  return <section className="member-hub__panel">
    <h2>Bills &amp; Bookings</h2>
    <div className="member-hub__filters" aria-label="Filter bills and bookings">
      <label>From date
        <input type="date" value={filters.from} onChange={(event) => setFilter('from', event.target.value)} />
      </label>
      <label>To date
        <input type="date" value={filters.to} onChange={(event) => setFilter('to', event.target.value)} />
      </label>
      <label>Status
        <select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
          <option value="">All statuses</option>
          <option value="confirmed">Confirmed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
    </div>
    <button className="member-hub__retry" type="button" disabled={loading} onClick={() => load(1, filters)}>Apply filters</button>
    {loading && !data && <p className="member-hub__loading" role="status">Loading your bills…</p>}
    {error && <ErrorMessage message={error} retry={() => load(page, filters)} />}
    {data && (data.items.length
      ? <>
        <div className="member-hub__table-wrap">
          <table className="member-hub__table">
            <thead><tr>{['Date', 'Service', 'Booking / bill ID', 'Bill amount', 'Discount', 'Points used', 'Balance after', 'Status', 'Refunded points'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.items.map((bill, index) => <tr key={`${bill.billId || bill.bookingId || bill.date}-${index}`}>
              <td>{formatDate(bill.date)}</td>
              <td>{String(bill.service || '—').replaceAll('_', ' ')}</td>
              <td>{bill.bookingId || bill.billId || '—'}</td>
              <td>{formatINR(bill.billAmount)}</td>
              <td>50%</td>
              <td>{formatPts(bill.pointsUsed)}</td>
              <td>{formatPts(bill.balanceAfter)}</td>
              <td><StatusChip status={bill.status} /></td>
              <td>{formatPts(bill.refundedPoints)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="member-hub__cards">
          {data.items.map((bill, index) => <article className="member-hub__bill-card" key={`${bill.billId || bill.bookingId || bill.date}-card-${index}`}>
            <strong>{String(bill.service || 'Service').replaceAll('_', ' ')} <StatusChip status={bill.status} /></strong>
            <span className="member-hub__subtle">{formatDate(bill.date)}</span>
            <dl>
              <div><dt>Booking / bill ID</dt><dd>{bill.bookingId || bill.billId || '—'}</dd></div>
              <div><dt>Bill amount</dt><dd>{formatINR(bill.billAmount)}</dd></div>
              <div><dt>Discount</dt><dd>50%</dd></div>
              <div><dt>Points used</dt><dd>{formatPts(bill.pointsUsed)}</dd></div>
              <div><dt>Balance after</dt><dd>{formatPts(bill.balanceAfter)}</dd></div>
              <div><dt>Refunded points</dt><dd>{formatPts(bill.refundedPoints)}</dd></div>
            </dl>
          </article>)}
        </div>
      </>
      : <EmptyState>{membership ? 'No bills or bookings match these filters.' : <>No membership yet. <Link to="/luxury-membership">Explore membership plans</Link></>}</EmptyState>)}
    {data && <PaginationControls data={data} page={page} loading={loading} onPage={(nextPage) => load(nextPage, filters)} />}
  </section>;
}

function PointsHistoryTab({ membership, onSessionExpired }) {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (nextPage = page, { silent = false } = {}) => {
    if (!membership || membership.status !== 'active') {
      setData({ items: [], page: 1, pages: 0, total: 0 });
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      setData(await getMyPointsHistory({ page: nextPage, limit: rowsPerPage }));
      if (!silent) setPage(nextPage);
    } catch (failure) {
      if (!silent) {
        if (failure.status === 401) onSessionExpired();
        setError(failure.message || 'Could not load your points history.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [membership, onSessionExpired, page]);

  useEffect(() => {
    load(1);
  }, [membership?._id]);

  useAutoRefresh(() => load(page, { silent: true }), { enabled: Boolean(membership) });

  return <section className="member-hub__panel">
    <h2>Points History</h2>
    {membership && membership.status !== 'active' && <p className="member-hub__warning" role="status">
      Payment received. Your membership is under review. Points will appear after approval.
    </p>}
    {loading && !data && <p className="member-hub__loading" role="status">Loading your points history…</p>}
    {error && <ErrorMessage message={error} retry={() => load(page)} />}
    {data && (data.items.length
      ? <>
        <div className="member-hub__table-wrap">
          <table className="member-hub__table">
            <thead><tr>{['Date', 'Amount basis', 'Points', 'Status'].map((label) => <th key={label}>{label}</th>)}</tr></thead>
            <tbody>{data.items.map((entry, index) => <tr key={`${entry.date}-${entry.type}-${index}`}>
              <td>{formatDate(entry.date, true)}</td>
              <td>{entry.amountBasis === null || entry.amountBasis === undefined ? '—' : formatINR(entry.amountBasis)}</td>
              <td>{entry.points < 0 ? '−' : '+'}{formatPts(Math.abs(entry.points))}</td>
              <td>{String(entry.status || 'active').replaceAll('_', ' ')}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="member-hub__cards">
          {data.items.map((entry, index) => <article className="member-hub__bill-card" key={`${entry.date}-${entry.type}-card-${index}`}>
            <strong>{formatDate(entry.date, true)}</strong>
            <dl>
              <div><dt>Amount basis</dt><dd>{entry.amountBasis === null || entry.amountBasis === undefined ? '—' : formatINR(entry.amountBasis)}</dd></div>
              <div><dt>Points</dt><dd>{entry.points < 0 ? '−' : '+'}{formatPts(Math.abs(entry.points))}</dd></div>
              <div><dt>Status</dt><dd>{String(entry.status || 'active').replaceAll('_', ' ')}</dd></div>
            </dl>
          </article>)}
        </div>
      </>
      : <EmptyState>{membership ? 'Your points activity will appear here.' : <>No membership yet. <Link to="/luxury-membership">Explore membership plans</Link></>}</EmptyState>)}
    {data && <PaginationControls data={data} page={page} loading={loading} onPage={load} />}
  </section>;
}

export default function MemberDashboardPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState(() => (
    tabs.includes(requestedTab) ? requestedTab : 'Overview'
  ));
  const [membership, setMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(true);
  const [membershipError, setMembershipError] = useState('');
  const [qrUrl, setQrUrl] = useState('');

  const handleSessionExpired = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }, [logout, navigate]);

  const loadMembership = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setMembershipLoading(true);
      setMembershipError('');
      setMembership(null);
      setQrUrl('');
    }
    try {
      const current = await getMyMembership();
      setMembership(current);
      if (!silent && current.memberCode) {
        try {
          setQrUrl(await getMyMembershipQr());
        } catch (failure) {
          if (failure.status === 401 && !silent) {
            await handleSessionExpired();
            return;
          }
          if (!silent) setMembershipError(failure.message || 'Could not load your membership QR code.');
        }
      }
    } catch (failure) {
      if (silent) return;
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      if (failure.status === 404) {
        setMembership(null);
        return;
      }
      setMembershipError(failure.message || 'Could not load your membership.');
    } finally {
      if (!silent) setMembershipLoading(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    loadMembership();
  }, [loadMembership]);

  useAutoRefresh(() => loadMembership({ silent: true }), { enabled: tab === 'Overview' });

  useEffect(() => () => {
    if (qrUrl) URL.revokeObjectURL(qrUrl);
  }, [qrUrl]);

  function renderOverview() {
    if (membershipLoading && !membership) {
      return <p className="member-hub__loading" role="status">Loading your membership…</p>;
    }
    if (membershipError && !membership) {
      return <ErrorMessage message={membershipError} retry={loadMembership} />;
    }
    if (!membership) {
      return <EmptyState>
        <strong>Your membership journey starts here.</strong>
        <p>You do not have a membership yet.</p>
        <Link to="/luxury-membership">Explore membership plans</Link>
      </EmptyState>;
    }

    const approved = membership.status === 'active';
    const pointsBalance = Number(membership.pointsBalance) || 0;
    const paymentConfirmed = Boolean(membership.paymentConfirmedAt)
      || ['pending_approval', 'active', 'expired'].includes(membership.status);
    const stages = [
      { label: 'Details and plan', complete: Boolean(membership.tier) },
      { label: 'Payment confirmed', complete: paymentConfirmed },
      { label: 'Admin approval', complete: approved },
      { label: 'Points credited', complete: approved && membership.pointsCredited },
    ];
    return <>
      {membershipError && <ErrorMessage message={membershipError} retry={loadMembership} />}
      <ol className="member-hub__progress" aria-label="Membership progress">
        {stages.map((stage, index) => <li
          className={`${stage.complete ? 'is-complete' : ''}${!stage.complete && (index === 0 || stages[index - 1]?.complete) ? ' is-current' : ''}`}
          key={stage.label}
        ><span aria-hidden="true">{stage.complete ? '✓' : index + 1}</span>{stage.label}</li>)}
      </ol>
      {!approved && <p className="member-hub__warning" role="status">
        {paymentConfirmed
          ? 'Payment received. Your membership is under review.'
          : 'Your membership details are saved. Complete payment to continue.'}
      </p>}
      {approved && <div className="member-hub__grid">
        <article className="member-hub__membership">
          <p className="member-hub__eyebrow">Membership overview</p>
          <h2>{membership.tier || 'OrianaaClub Membership'}</h2>
          <p>Welcome, {user?.firstName || 'Member'}</p>
          <div className="member-hub__badges">
            {membership.discountPercent > 0 && <span className="member-hub__badge">{membership.discountPercent}% discount active</span>}
            <span className="member-hub__badge">{String(membership.status || 'pending').replaceAll('_', ' ')}</span>
          </div>
          <p className="member-hub__code">Member ID: {formatMemberCode(membership.memberCode || membership.memberNo)}</p>
          <div className="member-hub__validity">
            {membership.membershipExpireAt && <div className="member-hub__validity-box">
              <span>Membership valid until</span>
              <strong>{formatValidityDate(membership.membershipExpireAt)}</strong>
              {formatValidityYears(membership.membershipValidityYears) && (
                <small>{formatValidityYears(membership.membershipValidityYears)}</small>
              )}
            </div>}
            {membership.pointsExpireAt && <div className="member-hub__validity-box">
              <span>Points valid until</span>
              <strong>{formatValidityDate(membership.pointsExpireAt)}</strong>
              {formatValidityYears(membership.pointsValidityYears) && (
                <small>{formatValidityYears(membership.pointsValidityYears)}</small>
              )}
            </div>}
          </div>
          {qrUrl && <img className="member-hub__qr" src={qrUrl} alt={`Membership QR code for ${formatMemberCode(membership.memberCode || membership.memberNo)}`} />}
        </article>
        <article className="member-hub__points">
          <span className="member-hub__points-label">Available Points</span>
          <strong className="member-hub__points-value">{formatPts(pointsBalance)}</strong>
          <span className="member-hub__points-equivalent">Equivalent value: {formatINR(pointsBalance)}</span>
          {membership.pointsExpireAt && <span className="member-hub__points-validity">
            Valid until {formatValidityDate(membership.pointsExpireAt)}
          </span>}
        </article>
      </div>}
    </>;
  }

  return <main className="member-hub">
    <div className="member-hub__inner">
      <header>
        <p className="member-hub__eyebrow">O R I A N A A  C L U B</p>
        <h1 className="member-hub__heading">My Dashboard</h1>
        <p className="member-hub__intro">Your membership, bookings, and rewards in one place.</p>
      </header>
      <div className="member-hub__tabs" role="tablist" aria-label="Member dashboard sections">
        {tabs.map((label) => <button
          key={label}
          className="member-hub__tab"
          type="button"
          role="tab"
          aria-selected={tab === label}
          onClick={() => setTab(label)}
        >{label}</button>)}
      </div>
      <div role="tabpanel" aria-label={tab}>
        {tab === 'Overview' && <section className="member-hub__panel">{renderOverview()}</section>}
        {tab === 'Family' && <FamilyDashboardTab />}
        {tab === 'Documents' && <IdentityDocumentsPanel />}
        {tab === 'Renew' && <RenewDashboardTab />}
        {tab === 'Bills & Bookings' && <BillsTab membership={membership} onSessionExpired={handleSessionExpired} />}
        {tab === 'Points History' && <PointsHistoryTab membership={membership} onSessionExpired={handleSessionExpired} />}
        {tab === 'Payments & Receipts' && <PaymentsReceiptsTab onSessionExpired={handleSessionExpired} />}
        {tab === 'Review' && <ReviewTab onSessionExpired={handleSessionExpired} />}
      </div>
    </div>
  </main>;
}
