// Phase 3: Show a member's membership summary, points balance, and ledger history.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getPoints } from '../../lib/pointsApi.js';
import './Dashboard.css';

const categories = [
  ['membership_award', 'Membership award'],
  ['food', 'Food'],
  ['dance_floor', 'Dance floor'],
  ['stay', 'Stay'],
  ['spa', 'Spa'],
  ['event', 'Event'],
  ['other', 'Other'],
  ['adjustment', 'Adjustment'],
  ['refund', 'Refund'],
];

const formatPoints = (amount) => Number(amount || 0).toLocaleString('en-IN');
const formatDate = (value) => new Intl.DateTimeFormat('en-IN', {
  dateStyle: 'medium',
  timeStyle: 'short',
}).format(new Date(value));

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ type: '', category: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getPoints({ ...filters, page, limit: 10 })
      .then((pointsData) => active && setData(pointsData))
      .catch((requestError) => active && setError(requestError.message || 'Could not load your points right now.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filters, page]);

  function changeFilter(key, value) {
    setLoading(true);
    setError('');
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  }

  function changePage(nextPage) {
    setLoading(true);
    setError('');
    setPage(nextPage);
  }

  const membership = data?.membership;
  const history = data?.history;
  const isActive = membership?.status === 'active';

  return (
    <main className="member-dashboard">
      <header className="member-dashboard__header">
        <p className="member-dashboard__eyebrow">ORI A N A A  C L U B</p>
        <h1>Member Dashboard</h1>
        <p>Your membership and points, together in one place.</p>
      </header>

      {error && <div className="member-dashboard__alert" role="alert">{error}</div>}
      {loading && !data && <p className="member-dashboard__loading" role="status">Loading your dashboard…</p>}

      {data && (
        <>
          <section className="member-dashboard__top-grid">
            <article className="dashboard-card dashboard-membership">
              <div className="dashboard-card__heading">
                <span>Membership</span>
                <span className={`dashboard-status ${isActive ? 'is-active' : ''}`}>
                  {membership?.status?.replaceAll('_', ' ') || 'Not started'}
                </span>
              </div>
              {membership ? (
                <>
                  <h2>{membership.plan?.title || 'Orianaa Club Membership'}</h2>
                  <p>{membership.plan?.subtitle}</p>
                  {membership.memberId && <p className="dashboard-member-id">Member ID <strong>{membership.memberId}</strong></p>}
                  {!membership.memberId && membership.memberNumber && (
                    <p className="dashboard-member-id">Member number <strong>{membership.memberNumber}</strong></p>
                  )}
                </>
              ) : (
                <div className="dashboard-empty-membership">
                  <h2>Your membership journey starts here</h2>
                  <p>You do not have a membership application yet.</p>
                  <Link to="/luxury-membership">Explore membership plans</Link>
                </div>
              )}
            </article>
            <article className="dashboard-card dashboard-points">
              <span className="dashboard-card__heading">Available points</span>
              <strong className="dashboard-points__balance">{formatPoints(data.balance)}</strong>
              <span className="dashboard-points__caption">ORI A N A A  REWARDS</span>
            </article>
          </section>

          {!isActive && (
            <section className="dashboard-not-active" role="status">
              <span className="dashboard-not-active__mark">✦</span>
              <div>
                <h2>Your points ledger will be ready when your membership is active.</h2>
                <p>Complete your application and wait for membership confirmation to start enjoying your rewards.</p>
              </div>
            </section>
          )}

          <section className="dashboard-history">
            <div className="dashboard-history__heading">
              <div>
                <p className="member-dashboard__eyebrow">YOUR REWARDS</p>
                <h2>Points history</h2>
              </div>
              <div className="dashboard-filters" aria-label="Filter points history">
                <label>Type
                  <select value={filters.type} onChange={(event) => changeFilter('type', event.target.value)}>
                    <option value="">All types</option><option value="credit">Credit</option><option value="debit">Debit</option>
                  </select>
                </label>
                <label>Category
                  <select value={filters.category} onChange={(event) => changeFilter('category', event.target.value)}>
                    <option value="">All categories</option>
                    {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label>From
                  <input type="date" value={filters.from} onChange={(event) => changeFilter('from', event.target.value)} />
                </label>
                <label>To
                  <input type="date" value={filters.to} onChange={(event) => changeFilter('to', event.target.value)} />
                </label>
              </div>
            </div>

            <div className="dashboard-table-wrap">
              <table className="dashboard-table">
                <thead>
                  <tr><th>Date</th><th>Activity</th><th>Details</th><th>Points</th><th>Balance after</th></tr>
                </thead>
                <tbody>
                  {history?.items?.map((item) => (
                    <tr key={item._id}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td><span className={`dashboard-entry-type dashboard-entry-type--${item.type}`}>{item.type}</span></td>
                      <td><strong>{item.category.replaceAll('_', ' ')}</strong><small>{item.reason}</small></td>
                      <td className={item.type === 'credit' ? 'dashboard-credit' : 'dashboard-debit'}>
                        {item.type === 'credit' ? '+' : '−'}{formatPoints(item.amount)}
                      </td>
                      <td>{formatPoints(item.balanceAfter)}</td>
                    </tr>
                  ))}
                  {!loading && !history?.items?.length && (
                    <tr><td colSpan="5" className="dashboard-table__empty">
                      {isActive ? 'No points transactions match these filters.' : 'Points activity will appear here after membership confirmation.'}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="dashboard-pagination">
              <span>{history?.total || 0} transactions</span>
              <div>
                <button type="button" disabled={!history?.page || history.page <= 1 || loading} onClick={() => changePage((current) => current - 1)}>Previous</button>
                <span>Page {history?.page || 1} of {Math.max(1, history?.pages || 0)}</span>
                <button type="button" disabled={!history?.pages || history.page >= history.pages || loading} onClick={() => changePage((current) => current + 1)}>Next</button>
              </div>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
