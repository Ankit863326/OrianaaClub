import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client.js';
import {
  Button,
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

const pageSize = 20;
const emptyFilters = { entityType: '', actor: '', action: '', memberNo: '', from: '', to: '' };

function actorLabel(entry) {
  return entry.admin?.firstName
    || entry.admin?.email
    || entry.actorType
    || entry.actorId
    || '—';
}

function jsonValue(value) {
  if (value === null || value === undefined) return '—';
  return JSON.stringify(value, null, 2);
}

export default function MembershipAuditLogPage() {
  const [filters, setFilters] = useState(emptyFilters);
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load(nextPage = page, nextFilters = filters) {
    setLoading(true);
    setError('');
    try {
      const result = await membershipApi.audit({
        ...nextFilters,
        page: nextPage,
        limit: pageSize,
      });
      setData(result);
      setPage(nextPage);
      setExpanded(new Set());
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(1, emptyFilters);
  }, []);

  function toggleExpanded(id) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Audit Log" description="Review administrator and system actions for membership operations." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    <Panel className="mb-5">
      <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6" onSubmit={(event) => {
        event.preventDefault();
        load(1, filters);
      }}>
        <FormField label="Entity type">
          <input className={controlClass} maxLength="80" value={filters.entityType} onChange={(event) => setFilters({ ...filters, entityType: event.target.value })} />
        </FormField>
        <FormField label="Actor">
          <input className={controlClass} maxLength="100" value={filters.actor} onChange={(event) => setFilters({ ...filters, actor: event.target.value })} placeholder="Name, email, or actor type" />
        </FormField>
        <FormField label="Action">
          <input className={controlClass} maxLength="80" value={filters.action} onChange={(event) => setFilters({ ...filters, action: event.target.value })} />
        </FormField>
        <FormField label="Member number">
          <input className={controlClass} maxLength="40" value={filters.memberNo} onChange={(event) => setFilters({ ...filters, memberNo: event.target.value })} placeholder="OC-xxxx or family suffix" />
        </FormField>
        <FormField label="From date">
          <input className={controlClass} type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        </FormField>
        <FormField label="To date">
          <input className={controlClass} type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        </FormField>
        <div className="flex gap-2 xl:col-span-6">
          <Button type="submit" disabled={loading}>Apply filters</Button>
          <Button type="button" variant="secondary" disabled={loading} onClick={() => {
            setFilters(emptyFilters);
            load(1, emptyFilters);
          }}>Clear filters</Button>
        </div>
      </form>
    </Panel>
    {!data && loading && <LoadingState />}
    {!data && error && <Button variant="secondary" onClick={() => load(1)}>Retry</Button>}
    {data && <>
      {loading && <p className="mb-3 text-sm text-slate-500" role="status">Loading audit entries…</p>}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-soft">
        <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>{['Date', 'Actor', 'Member code', 'Action', 'Entity', 'Reason', 'Details'].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.items.map((entry) => <AuditLogRows
              key={entry._id}
              entry={entry}
              expanded={expanded.has(entry._id)}
              onToggle={() => toggleExpanded(entry._id)}
            />)}
            {!data.items.length && <tr><td className="px-4 py-10 text-center text-slate-500" colSpan="7">No audit entries match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination info={data} onPage={(nextPage) => load(nextPage)} />
    </>}
  </section>;
}

function AuditLogRows({ entry, expanded, onToggle }) {
  return <>
    <tr>
      <td className="px-4 py-3.5 text-slate-700">{formatDate(entry.createdAt)}</td>
      <td className="px-4 py-3.5 text-slate-700">{actorLabel(entry)}</td>
      <td className="px-4 py-3.5 text-slate-700">{entry.memberNo ? (entry.memberNo.startsWith('OC-') ? entry.memberNo : `OC-${entry.memberNo}`) : '—'}</td>
      <td className="px-4 py-3.5 text-slate-700">{entry.action}</td>
      <td className="px-4 py-3.5 text-slate-700">{entry.entityType}{entry.entityId ? <small className="block text-slate-500">{entry.entityId}</small> : null}</td>
      <td className="max-w-80 px-4 py-3.5 text-slate-700">{entry.reason || '—'}</td>
      <td className="px-4 py-3.5"><Button variant="secondary" aria-expanded={expanded} onClick={onToggle}>{expanded ? 'Hide' : 'View'}</Button></td>
    </tr>
    {expanded && <tr>
      <td className="bg-slate-50 px-4 py-4" colSpan="7">
        <div className="grid gap-4 md:grid-cols-2">
          <section><h3 className="mb-2 font-semibold text-slate-700">Before</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs text-slate-700">{jsonValue(entry.before)}</pre></section>
          <section><h3 className="mb-2 font-semibold text-slate-700">After</h3><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-white p-3 text-xs text-slate-700">{jsonValue(entry.after)}</pre></section>
        </div>
      </td>
    </tr>}
  </>;
}
