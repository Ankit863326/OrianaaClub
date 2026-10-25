import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import api from '../../api/client.js';
import { getImageUrl } from '../../api/image.js';
import {
  Button,
  ConfirmDialog,
  FormField,
  LoadingState,
  Panel,
  Toast,
  controlClass,
  formatDate,
} from '../../components/ui.jsx';
import { membershipApi } from '../../api/membership.js';

const blankForm = { name: '', relation: '', dateOfBirth: '', phone: '' };

function familyMembers(family) {
  return [...(family?.adults || []), ...(family?.children || [])];
}

function memberName(member) {
  return member.name || member.fullName || 'Unnamed member';
}

function photoUrl(member) {
  return getImageUrl(member.photoUrl || member.photo);
}

export default function FamilyTab() {
  const { id } = useParams();
  const [family, setFamily] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [photo, setPhoto] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  const members = useMemo(() => familyMembers(family), [family]);
  const countedMembers = members.filter((member) => (
    member.status !== 'removed' && member.pendingAction !== 'remove'
  ));
  const activeAdults = members.filter((member) => (
    member.type === 'adult' && member.status === 'active' && member.pendingAction !== 'remove'
  ));
  const requests = members.filter((member) => Boolean(member.pendingAction));

  async function load() {
    setError('');
    setLoading(true);
    try {
      setFamily(await membershipApi.family(id));
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function startAdd() {
    setEditing(null);
    setFormOpen(true);
    setForm(blankForm);
    setPhoto(null);
  }

  function startEdit(member) {
    setEditing(member);
    setFormOpen(true);
    setForm({
      name: member.name || member.fullName || '',
      relation: member.relation || member.relationship || '',
      dateOfBirth: member.dateOfBirth ? new Date(member.dateOfBirth).toISOString().slice(0, 10) : '',
      phone: member.phone || '',
    });
    setPhoto(null);
  }

  async function saveMember(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const values = {
        name: form.name.trim(),
        relation: form.relation.trim(),
        dateOfBirth: form.dateOfBirth || undefined,
        phone: form.phone.trim(),
      };
      if (editing) {
        await api.patch(`/admin/family/${encodeURIComponent(editing._id)}`, values);
      } else if (photo) {
        const body = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value !== undefined) body.append(key, value);
        });
        body.append('photo', photo);
        await api.post(`/admin/memberships/${encodeURIComponent(id)}/family`, body);
      } else {
        await membershipApi.addFamily(id, values);
      }
      setEditing(null);
      setFormOpen(false);
      setPhoto(null);
      setNotice(editing ? 'Family member updated.' : 'Family member added.');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function executeAction() {
    if (!confirmation) return;
    if (confirmation.type === 'reject-request' && !confirmation.reason.trim()) {
      setError('A reason is required to reject a family request.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { type, member, reason = '' } = confirmation;
      if (type === 'remove') {
        await api.delete(`/admin/family/${encodeURIComponent(member._id)}`, { data: { reason: reason.trim() } });
        setNotice(`${memberName(member)} removed from the membership.`);
      } else if (type === 'clear-nominee') {
        await membershipApi.setNominee(id, null);
        setNotice('Nominee cleared.');
      } else if (type === 'approve-request' || type === 'reject-request') {
        await membershipApi.decideFamilyRequest(member._id, type === 'approve-request', reason.trim());
        setNotice(type === 'approve-request' ? 'Family request approved.' : 'Family request rejected.');
      }
      setConfirmation(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function setNominee(member) {
    setBusy(true);
    setError('');
    try {
      await membershipApi.setNominee(id, member?._id || null);
      setNotice(member ? `${memberName(member)} is now the nominee.` : 'Nominee cleared.');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  function updateRequestReason(reason) {
    setConfirmation((current) => ({ ...current, reason }));
  }

  function renderMember(member) {
    const lastAdult = member.type === 'adult' && member.status === 'active' && activeAdults.length <= 1;
    const image = photoUrl(member);
    return <article key={member._id} className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        {image
          ? <img className="size-16 rounded-xl border border-slate-200 object-cover" src={image} alt={`${memberName(member)} photo`} />
          : <div className="grid size-16 place-items-center rounded-xl bg-slate-100 text-xs text-slate-500">No photo</div>}
        <div className="min-w-48 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-semibold text-slate-900">{memberName(member)}</h4>
            {member.isNominee && <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">Nominee</span>}
          </div>
          <p className="mt-1 text-sm text-slate-600">{member.relation || member.relationship || '—'}</p>
          <p className="mt-1 text-sm text-slate-600">Date of birth: {formatDate(member.dateOfBirth || member.dob)}</p>
          <p className="mt-1 text-sm text-slate-600">Phone: {member.phone || '—'}</p>
          {member.type === 'child' && <p className="mt-2 text-sm text-amber-800">Children cannot be nominees.</p>}
          {lastAdult && <p className="mt-2 text-sm text-amber-800">At least one active adult must remain on the membership.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {member.type === 'adult' && member.status === 'active' && !member.isNominee && (
            <Button variant="secondary" disabled={busy} onClick={() => setNominee(member)}>Set as nominee</Button>
          )}
          {member.isNominee && <Button variant="secondary" disabled={busy} onClick={() => setConfirmation({ type: 'clear-nominee', member })}>Clear nominee</Button>}
          <Button variant="secondary" disabled={busy} onClick={() => startEdit(member)}>Edit</Button>
          <Button
            variant="danger"
            disabled={busy || lastAdult || member.isPrimary || member.status !== 'active'}
            onClick={() => setConfirmation({ type: 'remove', member, reason: '' })}
          >Remove</Button>
        </div>
      </div>
    </article>;
  }

  if (loading && !family) return <LoadingState />;

  return <section className="grid gap-5">
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {loading && <p className="text-sm text-slate-500" role="status">Loading family members…</p>}
    {!family && error && <Button variant="secondary" onClick={load}>Retry</Button>}
    {family && <>
      <Panel>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Family members</h2>
            <p className="mt-1 text-sm text-slate-500">{countedMembers.length} family profiles</p>
          </div>
          <Button disabled={busy} onClick={startAdd}>Add member</Button>
        </div>
        <div className="grid gap-5">
          {[
            ['Adults', family.adults || []],
            ['Children', family.children || []],
          ].map(([heading, sectionMembers]) => {
            const activeMembers = sectionMembers.filter((member) => (
              member.status === 'active' && member.pendingAction !== 'remove'
            ));
            return <section key={heading}>
              <h3 className="mb-3 font-semibold text-slate-800">{heading} ({activeMembers.length})</h3>
              {activeMembers.length
                ? <div className="grid gap-3">{activeMembers.map(renderMember)}</div>
                : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">No {heading.toLowerCase()} listed.</p>}
            </section>;
          })}
        </div>
        {activeAdults.length <= 1 && <p className="mt-5 text-sm text-amber-800">
          Last-adult rule: at least one active adult must always remain on this membership.
        </p>}
      </Panel>

      {requests.length > 0 && <Panel>
        <h2 className="mb-4 font-display text-xl">Pending family requests</h2>
        <div className="grid gap-3">
          {requests.map((request) => {
            const requestValues = request.pendingChanges || {};
            return <article key={request._id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-slate-900">{memberName(request)}</h3>
                  <p className="mt-1 text-sm text-slate-700">Request: {request.pendingAction}</p>
                  <p className="mt-1 text-sm text-slate-700">
                    {requestValues.name || request.name || request.fullName || '—'}
                    {requestValues.relation || request.relation ? ` · ${requestValues.relation || request.relation}` : ''}
                  </p>
                  {request.pendingAction === 'nominee' && <p className="mt-1 text-sm text-slate-600">Nominee requests are allowed for active adults only.</p>}
                </div>
                <div className="flex gap-2">
                  <Button disabled={busy} onClick={() => setConfirmation({ type: 'approve-request', member: request, reason: '' })}>Approve</Button>
                  <Button variant="danger" disabled={busy} onClick={() => setConfirmation({ type: 'reject-request', member: request, reason: '' })}>Reject</Button>
                </div>
              </div>
            </article>;
          })}
        </div>
      </Panel>}
    </>}

    {family && formOpen && <Panel>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveMember}>
        <h2 className="font-display text-xl sm:col-span-2">{editing ? `Edit ${memberName(editing)}` : 'Add family member'}</h2>
        <FormField label="Full name">
          <input className={controlClass} maxLength="120" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </FormField>
        <FormField label="Relation">
          <input className={controlClass} maxLength="40" required value={form.relation} onChange={(event) => setForm({ ...form, relation: event.target.value })} />
        </FormField>
        <FormField label="Date of birth">
          <input className={controlClass} type="date" value={form.dateOfBirth} onChange={(event) => setForm({ ...form, dateOfBirth: event.target.value })} />
        </FormField>
        <FormField label="Phone">
          <input className={controlClass} type="tel" maxLength="40" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </FormField>
        {!editing && <FormField label="Photo (JPG, PNG or WebP)" className="sm:col-span-2">
          <input className={controlClass} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setPhoto(event.target.files?.[0] || null)} />
        </FormField>}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add member'}</Button>
          <Button type="button" variant="secondary" onClick={() => { setEditing(null); setFormOpen(false); setForm(blankForm); setPhoto(null); }}>Cancel</Button>
        </div>
      </form>
    </Panel>}

    {confirmation && <ConfirmDialog
      title={confirmation.type === 'remove'
        ? `Remove ${memberName(confirmation.member)}?`
        : confirmation.type === 'clear-nominee'
          ? 'Clear the current nominee?'
          : `${confirmation.type === 'approve-request' ? 'Approve' : 'Reject'} family request?`}
      onCancel={() => setConfirmation(null)}
      onConfirm={executeAction}
      confirmLabel={confirmation.type === 'remove'
        ? 'Remove member'
        : confirmation.type === 'clear-nominee'
          ? 'Clear nominee'
          : confirmation.type === 'approve-request' ? 'Approve request' : 'Reject request'}
      busy={busy}
    >
      {confirmation.type === 'remove'
        ? <div className="grid gap-3">
          <p>This will remove the family member from this membership.</p>
          <FormField label="Reason (optional)">
            <textarea className={controlClass} rows="2" maxLength="1000" value={confirmation.reason} onChange={(event) => updateRequestReason(event.target.value)} />
          </FormField>
        </div>
        : confirmation.type === 'clear-nominee'
          ? `Clear ${memberName(confirmation.member)} as nominee?`
          : <div className="grid gap-3">
          <p>{confirmation.type === 'approve-request' ? 'Apply this member request?' : 'Reject this member request?'}</p>
          {confirmation.type === 'reject-request' && <FormField label="Reason for rejection">
            <textarea className={controlClass} rows="3" required maxLength="1000" value={confirmation.reason} onChange={(event) => updateRequestReason(event.target.value)} />
          </FormField>}
        </div>}
    </ConfirmDialog>}
  </section>;
}
