// This page supports single-member point adjustments and bulk credits by plan.
import { useState } from 'react';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { membershipApi } from '../api/membership.js';
import { Button, DataTable, FormField, PageHeading, Panel, Toast, controlClass, formatPoints } from '../components/ui.jsx';

const categories = ['adjustment', 'food', 'dance_floor', 'stay', 'spa', 'event', 'other', 'refund'];
const lookupErrorMessage = (failure) => failure.response?.data?.message || errorMessage(failure);

export default function PointsPage() {
  const [form, setForm] = useState({ membershipId: '', amount: '', category: 'adjustment', reason: '', mode: 'credit' });
  const [planSlug, setPlanSlug] = useState('');
  const [lookupMatches, setLookupMatches] = useState([]);
  const [selectedMembership, setSelectedMembership] = useState(null);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyMatches, setHistoryMatches] = useState([]);
  const [historySelection, setHistorySelection] = useState('');
  const [historyMember, setHistoryMember] = useState(null);
  const [history, setHistory] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function findMember(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSelectedMembership(null);
    try {
      const result = await membershipApi.lookup(form.membershipId);
      const matches = Array.isArray(result) ? result : result ? [result] : [];
      setLookupMatches(matches);
      if (matches.length === 1) setSelectedMembership(matches[0]);
      if (matches.length === 0) setError('No member found');
    } catch (failure) {
      setLookupMatches([]);
      setError(lookupErrorMessage(failure));
    }
  }

  async function submit(event) {
    event.preventDefault();
    setError('');
    setMessage('');
    try {
      const body = { amount: Number(form.amount), reason: form.reason };
      if (form.mode === 'bulk') {
        body.filter = { planSlug };
        const result = await adminApi.points(body);
        setMessage(`${result.succeeded} of ${result.total} memberships credited.`);
        return;
      }
      if (!selectedMembership) {
        setError('Find and select a member before submitting the adjustment.');
        return;
      }
      const result = await membershipApi.adjustPoints(selectedMembership.id, {
        ...body,
        direction: form.mode === 'credit' ? '+' : '-',
      });
      const updatedMember = { ...selectedMembership, pointsBalance: result.balanceAfter };
      setSelectedMembership(updatedMember);
      setHistoryMember(updatedMember);
      setHistory(await membershipApi.ledger(updatedMember.id, { page: 1, limit: 30 }));
      setMessage(`Points ${form.mode}ed successfully. New balance: ${formatPoints(result.balanceAfter)}.`);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function loadHistoryFor(member) {
    setHistoryMember(member);
    setHistory(await membershipApi.ledger(member.id, { page: 1, limit: 30 }));
  }

  async function loadHistory(event) {
    event.preventDefault();
    setError('');
    try {
      if (historySelection) {
        const selected = historyMatches.find((member) => member.id === historySelection);
        if (selected) {
          await loadHistoryFor(selected);
          return;
        }
      }
      const result = await membershipApi.lookup(historyQuery);
      const matches = Array.isArray(result) ? result : result ? [result] : [];
      setHistoryMatches(matches);
      setHistorySelection('');
      if (matches.length === 1) await loadHistoryFor(matches[0]);
      else if (matches.length === 0) {
        setHistory(null);
        setHistoryMember(null);
        setError('No member found');
      }
    } catch (failure) {
      setError(lookupErrorMessage(failure));
    }
  }

  const columns = [
    { key: 'createdAt', label: 'Date', render: (row) => row.createdAt ? new Date(row.createdAt).toLocaleString('en-IN') : '—' },
    { key: 'type', label: 'Type' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: (row) => formatPoints(row.amount) },
    { key: 'reason', label: 'Reason', render: (row) => row.note || row.reason || '—' }, { key: 'balanceAfter', label: 'Balance after', render: (row) => formatPoints(row.balanceAfter) },
  ];
  return <section>
    <PageHeading eyebrow="LOYALTY LEDGER" title="Points" description="Make traceable adjustments and inspect an individual member's ledger." />
    {error && <Toast kind="error">{error}</Toast>}{message && <Toast>{message}</Toast>}
    <Panel><form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
      <h2 className="font-display text-xl sm:col-span-2">Adjust points</h2>
      <FormField label="Action"><select className={controlClass} value={form.mode} onChange={(event) => setForm({ ...form, mode: event.target.value })}><option value="credit">Credit</option><option value="debit">Debit</option><option value="bulk">Bulk credit by plan</option></select></FormField>
      {form.mode === 'bulk' ? <FormField label="Plan slug"><input className={controlClass} required value={planSlug} onChange={(event) => setPlanSlug(event.target.value)} /></FormField> : <>
        <FormField label="Member ID or phone"><div className="flex gap-2"><input className={controlClass} required value={form.membershipId} onChange={(event) => { setForm({ ...form, membershipId: event.target.value }); setSelectedMembership(null); setLookupMatches([]); }} /><Button type="button" variant="secondary" onClick={findMember}>Find member</Button></div></FormField>
        <FormField label="Category"><select className={controlClass} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></FormField>
        {lookupMatches.length > 1 && <FormField label="Select member"><select className={controlClass} value={selectedMembership?.id || ''} onChange={(event) => setSelectedMembership(lookupMatches.find((member) => member.id === event.target.value) || null)}><option value="">Choose a member</option>{lookupMatches.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.memberCode || member.id}</option>)}</select></FormField>}
        {selectedMembership && <p className="text-sm text-slate-600 sm:col-span-2">Member: <strong>{selectedMembership.name || '—'}</strong> · Tier: <strong>{selectedMembership.tier || '—'}</strong> · Status: <strong>{selectedMembership.status}</strong> · Current balance: <strong>{formatPoints(selectedMembership.pointsBalance)}</strong></p>}
      </>}
      <FormField label="Amount (points)"><input className={controlClass} type="number" min="1" step="1" required value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></FormField>
      <FormField label="Reason"><input className={controlClass} minLength="1" maxLength="500" required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></FormField>
      <Button type="submit" className="sm:col-span-2 sm:justify-self-start">Submit adjustment</Button>
    </form></Panel>
    <Panel className="mt-5">
      <h2 className="mb-4 font-display text-xl">Member history</h2>
      <form className="mb-4 flex flex-col gap-3 sm:flex-row" onSubmit={loadHistory}><input className={controlClass} aria-label="Member ID, phone or name" placeholder="Member ID, phone or name" value={historyQuery} onChange={(event) => { setHistoryQuery(event.target.value); setHistorySelection(''); setHistoryMatches([]); }} /><Button type="submit" variant="secondary">Load history</Button></form>
      {historyMatches.length > 1 && <div className="mb-4 flex gap-3"><select className={controlClass} aria-label="Select member history" value={historySelection} onChange={(event) => setHistorySelection(event.target.value)}><option value="">Choose a member</option>{historyMatches.map((member) => <option key={member.id} value={member.id}>{member.name} — {member.memberCode || member.id}</option>)}</select><Button type="button" variant="secondary" onClick={loadHistory}>Load history</Button></div>}
      {history && <><p className="mb-4 text-sm text-slate-600">Current balance: <strong>{formatPoints(historyMember?.pointsBalance)}</strong></p><DataTable columns={columns} rows={history.items || []} /></>}
    </Panel>
  </section>;
}
