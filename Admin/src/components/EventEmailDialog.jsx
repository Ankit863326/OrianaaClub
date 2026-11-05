import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { Badge, Button, LoadingState, Pagination, Panel, Toast, controlClass, formatDate } from './ui.jsx';

const modes = [
  ['selected', 'Selected Members'],
  ['all', 'All Members'],
  ['test', 'Test to Me'],
];
const maxRecipients = 500;

export default function EventEmailDialog({ event, adminEmail, onClose, onSent }) {
  const [mode, setMode] = useState('selected');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [members, setMembers] = useState({ items: [], page: 1, pages: 1, total: 0, eligibleTotal: 0 });
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [step, setStep] = useState('compose');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingMembers(true);
    setError('');
    adminApi.memberSearch({ q: search, page, limit: 20 })
      .then((data) => {
        if (active) setMembers(data);
      })
      .catch((failure) => {
        if (active) setError(errorMessage(failure, 'Members could not be loaded.'));
      })
      .finally(() => {
        if (active) setLoadingMembers(false);
      });
    return () => { active = false; };
  }, [page, search]);

  const recipientCount = useMemo(() => {
    if (mode === 'selected') return selectedIds.size;
    if (mode === 'all') return members.eligibleTotal || 0;
    return 1;
  }, [members.eligibleTotal, mode, selectedIds]);

  function toggleMember(id) {
    if (!selectedIds.has(id) && selectedIds.size >= maxRecipients) {
      setError(`You can select up to ${maxRecipients} members per email.`);
      return;
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectCurrentPage() {
    const additionalSelections = members.items.filter((member) => !selectedIds.has(member._id)).length;
    if (selectedIds.size + additionalSelections > maxRecipients) {
      setError(`You can select up to ${maxRecipients} members per email.`);
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      members.items.forEach((member) => {
        if (next.size < maxRecipients) next.add(member._id);
      });
      return next;
    });
  }

  async function sendEmail() {
    setBusy(true);
    setError('');
    try {
      let data;
      if (mode === 'selected') {
        data = await adminApi.sendSelectedEvent(event._id, { memberIds: [...selectedIds] });
      } else if (mode === 'all') {
        data = await adminApi.sendAllEvent(event._id);
      } else {
        await adminApi.sendTestEvent(event._id);
        data = { total: 1, queued: 1, skippedOptOut: 0, skippedInvalid: 0 };
      }
      setResult(data);
      setStep('result');
      onSent?.();
    } catch (failure) {
      setError(errorMessage(failure, 'The event email could not be sent.'));
    } finally {
      setBusy(false);
    }
  }

  const skippedCount = result
    ? Math.max(0, Number(result.total || 0) - Number(result.queued || 0))
    : 0;

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-midnight/60 p-3 sm:p-6" role="presentation">
    <section className="my-auto max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7" role="dialog" aria-modal="true" aria-labelledby="event-email-title">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.18em] text-gold">Event email</p>
          <h2 id="event-email-title" className="mt-1 font-display text-2xl text-slate-900">{event.title}</h2>
        </div>
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
      </div>

      {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}

      {step === 'compose' && <>
        <div className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-3" role="tablist" aria-label="Email recipient options">
          {modes.map(([value, label]) => <label key={value} className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3 text-sm font-semibold ${mode === value ? 'border-forest bg-forest/5 text-forest' : 'border-slate-200 text-slate-600'}`}>
            <input type="radio" name="event-email-mode" value={value} checked={mode === value} onChange={() => setMode(value)} />
            {label}
          </label>)}
        </div>

        {mode === 'selected' && <Panel className="mb-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <strong className="text-sm text-slate-800">{selectedIds.size} selected</strong>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={selectCurrentPage} disabled={loadingMembers || !members.items.length}>Select all on this page</Button>
              <Button type="button" variant="secondary" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size}>Clear selection</Button>
            </div>
          </div>
          <input
            className={controlClass}
            aria-label="Search members"
            placeholder="Search name or email"
            value={search}
            onChange={(change) => { setSearch(change.target.value); setPage(1); }}
          />
          <p className="mt-1 text-xs text-slate-500">Up to {maxRecipients} members can be selected per send.</p>
          {loadingMembers ? <LoadingState /> : members.items.length ? <div className="mt-3 divide-y divide-slate-100">
            {members.items.map((member) => <label key={member._id} className="flex cursor-pointer items-center gap-3 py-3">
              <input type="checkbox" checked={selectedIds.has(member._id)} disabled={!selectedIds.has(member._id) && selectedIds.size >= maxRecipients} onChange={() => toggleMember(member._id)} />
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm text-slate-800">{member.name}</strong>
                <small className="block truncate text-slate-500">{member.email}</small>
              </span>
              <span className="flex flex-wrap justify-end gap-1">
                <Badge>{member.status}</Badge>
                <Badge>{member.emailVerified ? 'Verified' : 'Unverified'}</Badge>
                {member.emailOptOut && <Badge>Opted out</Badge>}
              </span>
            </label>)}
          </div> : <p className="py-6 text-center text-sm text-slate-500">No members match this search.</p>}
          {!loadingMembers && <Pagination info={members} onPage={setPage} />}
        </Panel>}

        {mode === 'all' && <Panel className="mb-5">
          {loadingMembers ? <LoadingState /> : <p className="text-sm leading-6 text-slate-600">
            This will email <strong className="text-slate-900">{recipientCount} active, verified member{recipientCount === 1 ? '' : 's'}</strong>
            {' '}who have not opted out. Members who already received this event email will be skipped.
          </p>}
        </Panel>}

        {mode === 'test' && <Panel className="mb-5">
          <p className="text-sm leading-6 text-slate-600">Send a preview to <strong className="text-slate-900">{adminEmail || 'your administrator email'}</strong>.</p>
        </Panel>}

        <div className="mb-5">
          <h3 className="mb-2 font-semibold text-slate-800">Email preview</h3>
          <EmailPreview event={event} />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="button" variant="gold" disabled={busy || (mode !== 'test' && loadingMembers) || recipientCount < 1 || (mode === 'test' && !adminEmail)} onClick={() => setStep('confirm')}>
            Continue with {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
          </Button>
        </div>
      </>}

      {step === 'confirm' && <div>
        <h3 className="font-display text-xl text-slate-900">Confirm event email</h3>
        <p className="my-3 text-sm leading-6 text-slate-600">You are about to send this email to <strong>{recipientCount} recipient{recipientCount === 1 ? '' : 's'}</strong>. Members who are ineligible, opted out, or already received this event email will be skipped.</p>
        <EmailPreview event={event} />
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep('compose')}>Back</Button>
          <Button type="button" variant="gold" disabled={busy} onClick={sendEmail}>{busy ? 'Sending…' : `Confirm and send to ${recipientCount}`}</Button>
        </div>
      </div>}

      {step === 'result' && result && <div>
        <h3 className="font-display text-xl text-slate-900">Email request complete</h3>
        <Panel className="my-4 grid gap-3 sm:grid-cols-2">
          <p className="text-sm text-slate-600">Queued <strong className="text-slate-900">{result.queued || 0}</strong></p>
          <p className="text-sm text-slate-600">Skipped <strong className="text-slate-900">{skippedCount}</strong></p>
          {result.skippedOptOut > 0 && <p className="text-sm text-slate-600">Opted out <strong>{result.skippedOptOut}</strong></p>}
          {result.skippedInvalid > 0 && <p className="text-sm text-slate-600">Invalid or ineligible <strong>{result.skippedInvalid}</strong></p>}
          {result.skippedAlreadySent > 0 && <p className="text-sm text-slate-600">Already sent <strong>{result.skippedAlreadySent}</strong></p>}
          {result.skippedAlreadyQueued > 0 && <p className="text-sm text-slate-600">Already queued <strong>{result.skippedAlreadyQueued}</strong></p>}
        </Panel>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          <Link className="inline-flex items-center justify-center rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white hover:bg-forest/90" to="/email-log" onClick={onClose}>Email History</Link>
        </div>
      </div>}
    </section>
  </div>;
}

function EmailPreview({ event }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gold">ORIANAA CLUB</p>
    <h4 className="font-display text-xl text-slate-900">{event.title}</h4>
    <p className="my-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{event.description}</p>
    <p className="text-sm font-semibold text-slate-800">{formatDate(event.date)}{event.time ? ` · ${event.time}` : ''}</p>
    <p className="text-sm text-slate-600">{event.location}</p>
  </div>;
}
