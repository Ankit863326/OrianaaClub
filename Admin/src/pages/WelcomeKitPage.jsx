import { useEffect, useState } from 'react';
import { Badge, Button, LoadingState, PageHeading, Panel, Toast, controlClass, formatDate } from '../components/ui.jsx';
import { welcomeKitApi } from '../api/welcomeKit.js';

const filters = [
  ['All', ''],
  ['Pending', 'pending'],
  ['Dispatched', 'dispatched'],
  ['Not home', 'not_home'],
  ['Delivered', 'delivered'],
];

function requestError(error) {
  return error.response?.data?.message || 'The welcome kit request could not be completed. Please try again.';
}

function statusLabel(status) {
  return status === 'not_home' ? 'Not home' : status.charAt(0).toUpperCase() + status.slice(1);
}

export default function WelcomeKitPage() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [staff, setStaff] = useState({});
  const [codes, setCodes] = useState({});
  const [notes, setNotes] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load({ silent = false } = {}) {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await welcomeKitApi.list({ status, search: query });
      setData(result);
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [status, query]);

  async function runAction(id, action, successMessage) {
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(successMessage);
      await load({ silent: true });
      setCodes((current) => ({ ...current, [id]: '' }));
    } catch (failure) {
      setError(requestError(failure));
    } finally {
      setBusyId('');
    }
  }

  function searchMembers(event) {
    event.preventDefault();
    setQuery(search.trim());
  }

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Welcome kits" description="Track delivery and verify each member's welcome kit code." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {data && <div className="mb-5 flex flex-wrap gap-3 text-sm">
      <Panel className="px-4 py-3"><span className="text-slate-500">Kits</span><strong className="ml-2 text-slate-900">{data.total}</strong></Panel>
      <Panel className="px-4 py-3"><span className="text-slate-500">Overdue</span><strong className="ml-2 text-red-700">{data.overdueCount}</strong></Panel>
    </div>}
    <Panel>
      <form className="mb-5 flex flex-col gap-3 sm:flex-row" onSubmit={searchMembers}>
        <input className={controlClass} aria-label="Search member ID" placeholder="Search member ID" value={search} onChange={(event) => setSearch(event.target.value)} />
        <Button type="submit" variant="secondary">Search</Button>
      </form>
      <div className="mb-5 flex flex-wrap gap-2" aria-label="Filter welcome kits">
        {filters.map(([label, value]) => <Button
          key={value || 'all'}
          type="button"
          variant={status === value ? 'primary' : 'secondary'}
          aria-pressed={status === value}
          onClick={() => setStatus(value)}
        >{label}</Button>)}
      </div>
      {loading && !data && <LoadingState />}
      {!loading && !data && error && <Button variant="secondary" onClick={() => load()}>Retry</Button>}
      {data && <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Member', 'Status', 'Staff', 'Date', 'Action'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((kit) => <tr key={kit._id} className={kit.overdue ? 'bg-red-50/70' : ''}>
              <td className="px-4 py-4 text-slate-700">
                <strong className="block">{kit.member.name}</strong>
                <span className="block text-xs text-slate-500">{kit.member.memberId || '—'}</span>
                <span className="block text-xs text-slate-500">{kit.member.mobile || '—'}</span>
              </td>
              <td className="px-4 py-4">
                <Badge tone={kit.status}>{statusLabel(kit.status)}</Badge>
                {kit.overdue && <span className="ml-2 text-xs font-semibold text-red-700">Overdue</span>}
                {kit.notHomeNote && <p className="mt-1 max-w-48 text-xs text-slate-500">{kit.notHomeNote}</p>}
              </td>
              <td className="px-4 py-4 text-slate-700">{kit.assignedStaff || '—'}</td>
              <td className="px-4 py-4 text-slate-700">{formatDate(kit.status === 'delivered' ? kit.deliveredAt : kit.dueAt)}</td>
              <td className="px-4 py-4">
                {kit.status === 'pending' || kit.status === 'not_home' ? <div className="flex min-w-64 gap-2">
                  <input
                    className={controlClass}
                    aria-label={`Delivery staff for ${kit.member.memberId || kit.member.name}`}
                    placeholder="Delivery staff name"
                    value={staff[kit._id] ?? ''}
                    onChange={(event) => setStaff((current) => ({ ...current, [kit._id]: event.target.value }))}
                  />
                  <Button
                    type="button"
                    disabled={busyId === kit._id || !staff[kit._id]?.trim()}
                    onClick={() => runAction(kit._id, () => welcomeKitApi.dispatch(kit._id, staff[kit._id].trim()), 'Welcome kit dispatched.')}
                  >Dispatch</Button>
                </div> : null}
                {kit.status === 'dispatched' && <div className="grid min-w-72 gap-2">
                  {kit.locked
                    ? <p className="text-xs font-semibold text-red-700">Code locked after five incorrect attempts. Mark not home to dispatch again.</p>
                    : <input
                      className={controlClass}
                      aria-label={`Delivery code for ${kit.member.memberId || kit.member.name}`}
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={6}
                      placeholder="6-digit delivery code"
                      value={codes[kit._id] ?? ''}
                      onChange={(event) => setCodes((current) => ({ ...current, [kit._id]: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    />}
                  <input
                    className={controlClass}
                    aria-label={`Not-home note for ${kit.member.memberId || kit.member.name}`}
                    placeholder="Not-home note (optional)"
                    maxLength={500}
                    value={notes[kit._id] ?? ''}
                    onChange={(event) => setNotes((current) => ({ ...current, [kit._id]: event.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={kit.locked || busyId === kit._id || codes[kit._id]?.length !== 6}
                      onClick={() => runAction(kit._id, () => welcomeKitApi.deliver(kit._id, codes[kit._id]), 'Welcome kit marked delivered.')}
                    >Mark delivered</Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busyId === kit._id}
                      onClick={() => runAction(kit._id, () => welcomeKitApi.notHome(kit._id, notes[kit._id] || ''), 'Welcome kit marked not home.')}
                    >Not home</Button>
                  </div>
                </div>}
                {kit.status === 'delivered' && <span className="font-semibold text-emerald-700">Done</span>}
              </td>
            </tr>)}
            {!data.items.length && <tr><td className="px-4 py-8 text-center text-slate-500" colSpan="5">No welcome kits found.</td></tr>}
          </tbody>
        </table>
      </div>}
    </Panel>
  </section>;
}
