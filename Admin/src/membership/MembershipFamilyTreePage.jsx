import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import {
  Badge,
  Button,
  LoadingState,
  PageHeading,
  Panel,
  Toast,
  formatDate,
  formatRupees,
} from '../components/ui.jsx';
import { membershipApi } from '../api/membership.js';

function familyGroup(member) {
  const type = String(member.memberType || '').toLowerCase();
  const relation = String(member.relation || '').toLowerCase();
  if (type === 'spouse' || relation.includes('wife') || relation.includes('husband') || relation === 'spouse') return 'Spouse';
  if (type === 'child' || relation.includes('son') || relation.includes('daughter') || relation === 'child') return 'Children';
  if (['father', 'mother'].includes(type) || relation.includes('father') || relation.includes('mother')) {
    return member.parentSide === 'spouse' ? 'Spouse’s parents' : 'Member’s parents';
  }
  return 'Extended family';
}

function personName(person) {
  return person.name || person.relation || 'Member';
}

export default function MembershipFamilyTreePage() {
  const { memberNo } = useParams();
  const [tree, setTree] = useState(null);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setTree(await membershipApi.familyTree(memberNo));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, [memberNo]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const result = new Map();
    for (const member of tree?.family || []) {
      const group = familyGroup(member);
      result.set(group, [...(result.get(group) || []), member]);
    }
    return result;
  }, [tree]);

  return <section>
    <PageHeading
      eyebrow="MEMBERSHIP"
      title="Family Tree"
      description={`Family membership for ${tree?.primary?.name || memberNo}.`}
      actions={<Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" to="/membership/members">Back to members</Link>}
    />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {loading && !tree && <LoadingState />}
    {error && !tree && <Button variant="secondary" onClick={load}>Retry</Button>}
    {tree && <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
      <div className="grid gap-5">
        <Panel>
          <h2 className="mb-4 font-display text-xl">Primary member</h2>
          <PersonCard person={tree.primary} onClick={() => setSelected(tree.primary)} primary />
        </Panel>
        {['Spouse', 'Children', 'Member’s parents', 'Spouse’s parents', 'Extended family']
          .filter((group) => {
            const people = groups.get(group) || [];
            const hasSlot = (tree.openSlots || []).some((slot) => (
              group === 'Spouse' ? slot.key.startsWith('spouse')
                : group === 'Member’s parents' ? slot.key.startsWith('parent-member')
                  : group === 'Spouse’s parents' ? slot.key.startsWith('parent-spouse')
                    : group === 'Children' ? slot.key === 'children' : false
            ));
            return people.length || hasSlot;
          }).map((group) => {
          const people = groups.get(group) || [];
          return <Panel key={group}>
          <h2 className="mb-4 font-display text-xl">{group}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {people.map((person) => <PersonCard key={person.id} person={person} onClick={() => setSelected(person)} />)}
            {(tree.openSlots || []).filter((slot) => (
              group === 'Spouse' ? slot.key.startsWith('spouse')
                : group === 'Member’s parents' ? slot.key.startsWith('parent-member')
                  : group === 'Spouse’s parents' ? slot.key.startsWith('parent-spouse')
                  : group === 'Children' ? slot.key === 'children' : false
            )).map((slot) => <article key={slot.key} className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
              <strong className="block text-slate-700">Open slot: {slot.label}</strong>
              <span>{slot.discountPct}% family discount</span>
            </article>)}
            {!people.length && !((tree.openSlots || []).some((slot) => group === 'Spouse'
              ? slot.key.startsWith('spouse')
              : group === 'Member’s parents' ? slot.key.startsWith('parent-member')
                : group === 'Spouse’s parents' ? slot.key.startsWith('parent-spouse')
                  : group === 'Children' && slot.key === 'children'))
              && <p className="text-sm text-slate-500">No {group.toLowerCase()} listed.</p>}
          </div>
        </Panel>;
        })}
        <Panel>
          <h2 className="mb-4 font-display text-xl">Nominees</h2>
          {tree.nominees.length
            ? <div className="grid gap-3 sm:grid-cols-2">
              {tree.nominees.map((person) => <PersonCard key={person.id} person={person} onClick={() => setSelected(person)} />)}
            </div>
            : <p className="text-sm text-slate-500">No nominees listed.</p>}
        </Panel>
      </div>
      <Panel className="h-fit xl:sticky xl:top-24">
        {selected
          ? <MemberDetails person={selected} />
          : <p className="text-sm text-slate-500">Select a person to view membership and ledger details.</p>}
      </Panel>
    </div>}
  </section>;
}

function PersonCard({ person, onClick, primary = false }) {
  return <button
    type="button"
    className={`min-h-16 rounded-xl border p-4 text-left transition hover:border-forest hover:bg-emerald-50/30 ${primary ? 'border-gold bg-amber-50/40' : 'border-slate-200 bg-white'}`}
    onClick={onClick}
  >
    <span className="flex flex-wrap items-center justify-between gap-2">
      <strong className="text-slate-900">{personName(person)}</strong>
      <Badge>{String(person.status || 'profile only').replaceAll('_', ' ')}</Badge>
    </span>
    <span className="mt-1 block text-sm text-slate-500">
      {primary ? 'Primary member' : person.nominee ? `${person.nomineeRole || 'Nominee'} nominee` : person.relation}
      {person.memberNo ? ` · ${person.memberNo}` : ''}
    </span>
    {person.anniversaryDate && <span className="mt-1 block text-sm text-slate-600">
      Anniversary: {formatDate(person.anniversaryDate)}
    </span>}
  </button>;
}

function MemberDetails({ person }) {
  const rows = [
    ['Status', String(person.status || 'profile_only').replaceAll('_', ' ')],
    ['Anniversary', person.anniversaryDate ? formatDate(person.anniversaryDate) : '—'],
    ['Discount', `${Number(person.discountPct || 0)}%`],
    ['Base amount', formatRupees(person.baseAmount)],
    ['GST', formatRupees(person.gstAmount)],
    ['Total paid', formatRupees(person.totalPaid)],
    ['Approval sequence', person.approvalSeq ?? '—'],
    ['Rate phase', person.nominee ? 'No points' : person.ratePhase || '—'],
    ['Points', person.nominee ? 'No points' : Number(person.points || 0).toLocaleString('en-IN')],
    ['Aadhaar status', String(person.aadhaarStatus || 'not_added').replaceAll('_', ' ')],
  ];
  return <div>
    <p className="text-xs font-bold uppercase tracking-[.17em] text-gold">Member details</p>
    <h2 className="mt-1 font-display text-2xl text-slate-900">{personName(person)}</h2>
    <p className="mt-1 text-sm text-slate-500">Member ID: {person.memberId || person.memberNo || '—'}{person.relation ? ` · ${person.relation}` : ''}</p>
    <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
      {rows.map(([label, value]) => <div key={label}>
        <dt className="text-slate-500">{label}</dt><dd className="font-semibold capitalize text-slate-800">{value}</dd>
      </div>)}
    </dl>
    <section className="mt-6">
      <h3 className="font-display text-lg">Points ledger</h3>
      {person.nominee
        ? <p className="mt-2 text-sm text-slate-500">No points, no ledger.</p>
        : person.ledger?.length
          ? <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[500px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
                {['Credited', 'Basis', 'Multiplier', 'Phase', 'Points', 'Expires', 'Status'].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">{person.ledger.map((entry) => <tr key={entry._id}>
                <td className="px-3 py-2">{formatDate(entry.creditedAt)}</td>
                <td className="px-3 py-2">{formatRupees(entry.pointsBasis)}</td>
                <td className="px-3 py-2">{entry.multiplier}x</td>
                <td className="px-3 py-2">{String(entry.phase || '').replaceAll('_', ' ')}</td>
                <td className="px-3 py-2">{Number(entry.points || 0).toLocaleString('en-IN')}</td>
                <td className="px-3 py-2">{formatDate(entry.expiresAt)}</td>
                <td className="px-3 py-2">{entry.status}</td>
              </tr>)}</tbody>
            </table>
          </div>
          : <p className="mt-2 text-sm text-slate-500">No ledger entries.</p>}
    </section>
  </div>;
}
