import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../../config/api.js';
import useAuth from '../../context/useAuth.js';
import { getMyMembership } from './memberDashboardApi.js';
import {
  getMyFamily,
  requestFamilyMember,
  requestFamilyNominee,
  requestFamilyRemoval,
} from './memberDashboardActionsApi.js';

const allowedPhotoTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxPhotoSize = 10 * 1024 * 1024;
const numberFormat = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

function statusLabel(status, pendingAction) {
  if (pendingAction) return 'Pending approval';
  return String(status || 'unknown').replaceAll('_', ' ');
}

function StatusChip({ status, pendingAction }) {
  const pending = Boolean(pendingAction) || String(status || '').startsWith('pending');
  return <span className={`member-hub__status${pending ? ' member-hub__status--pending' : ''}`}>
    {statusLabel(status, pendingAction)}
  </span>;
}

function FamilyMemberCard({ member, type, activeAdultCount, currentNomineeId, onRemove, saving }) {
  const photo = member.photo || member.photoUrl;
  const canRequestRemoval = member.status === 'active'
    && !member.pendingAction
    && !member.isPrimary
    && !(type === 'adult' && activeAdultCount <= 1);

  return <article className="member-hub__bill-card">
    <div>
      {photo
        ? <img
          src={getImageUrl(photo)}
          alt={`${member.name || member.fullName || 'Family member'} profile`}
          loading="lazy"
          style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
        />
        : <span aria-hidden="true">{(member.name || member.fullName || '?').slice(0, 1).toUpperCase()}</span>}
    </div>
    <dl>
      <div><dt>Name</dt><dd>{member.name || member.fullName || '—'}</dd></div>
      <div><dt>Relation</dt><dd>{member.relation || member.relationship || '—'}</dd></div>
      <div><dt>Date of birth</dt><dd>{formatDate(member.dateOfBirth || member.dob)}</dd></div>
      <div><dt>Phone</dt><dd>{member.phone || '—'}</dd></div>
    </dl>
    <div className="member-hub__badges">
      <StatusChip status={member.status} pendingAction={member.pendingAction} />
      {member.isNominee || String(member.id) === String(currentNomineeId)
        ? <span className="member-hub__badge member-hub__badge--gold">Nominee</span>
        : null}
    </div>
    {member.isPrimary && <p className="member-hub__subtle">The primary member cannot be removed.</p>}
    {type === 'adult' && member.status === 'active' && activeAdultCount <= 1
      && <p className="member-hub__subtle">The last active adult cannot be removed.</p>}
    {member.pendingAction === 'remove'
      ? <p className="member-hub__subtle">Removal request is awaiting admin approval.</p>
      : canRequestRemoval && <button
        className="member-hub__retry"
        type="button"
        disabled={saving}
        onClick={() => onRemove(member)}
      >Request removal</button>}
  </article>;
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(date);
}

export default function FamilyDashboardTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [family, setFamily] = useState({ adults: [], children: [] });
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [nomineeId, setNomineeId] = useState('');

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
      const [familyResult, membershipResult] = await Promise.all([getMyFamily(), getMyMembership()]);
      setFamily({
        adults: Array.isArray(familyResult?.adults) ? familyResult.adults : [],
        children: Array.isArray(familyResult?.children) ? familyResult.children : [],
      });
      setMembership(membershipResult || null);
      setNomineeId(membershipResult?.nominee?.id || '');
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not load your family members.');
    } finally {
      setLoading(false);
    }
  }, [handleSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  const allMembers = useMemo(() => [...family.adults, ...family.children], [family]);
  const count = allMembers.filter((member) => ['active', 'pending_approval'].includes(member.status)
    && member.pendingAction !== 'remove').length;
  const activeAdultCount = family.adults.filter((member) => member.status === 'active'
    && member.pendingAction !== 'remove').length;
  const activeAdults = family.adults.filter((member) => member.status === 'active' && !member.pendingAction);
  const limit = Number(membership?.maxFamilyMembers || 6);
  const atLimit = count >= limit;

  async function onRemove(member) {
    const name = member.name || member.fullName || 'this family member';
    if (!window.confirm(`Request removal of ${name}? The request will need admin approval.`)) return;
    setSaving(true);
    setMessage('');
    setFormError('');
    try {
      await requestFamilyRemoval(member.id || member._id);
      setMessage('Removal request sent. It will take effect after admin approval.');
      await load();
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setFormError(failure.message || 'Could not submit the removal request.');
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const photo = form.elements.photo.files[0] || null;
    setFormError('');
    setMessage('');
    if (atLimit) {
      setFormError(`Your family has reached the ${limit}-member limit.`);
      return;
    }
    if (!values.dateOfBirth) {
      setFormError('Enter the family member’s date of birth.');
      return;
    }
    if (photo && !allowedPhotoTypes.has(photo.type)) {
      setFormError('Choose a JPG, JPEG, PNG, or WebP photo.');
      return;
    }
    if (photo && photo.size > maxPhotoSize) {
      setFormError('The photo must be 10 MB or smaller.');
      return;
    }

    setSaving(true);
    try {
      await requestFamilyMember({
        name: values.name,
        relation: values.relation,
        dateOfBirth: values.dateOfBirth,
        phone: values.phone,
      }, photo);
      form.reset();
      setMessage('Add-member request sent. It will appear as pending until an admin approves it.');
      await load();
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setFormError(failure.message || 'Could not submit the add-member request.');
    } finally {
      setSaving(false);
    }
  }

  async function onNomineeSubmit(event) {
    event.preventDefault();
    setFormError('');
    setMessage('');
    if (!activeAdults.some((adult) => String(adult.id || adult._id) === nomineeId)) {
      setFormError('Choose an existing active adult as nominee. Children cannot be nominees.');
      return;
    }
    if (!window.confirm('Submit this nominee request for admin approval?')) return;
    setSaving(true);
    try {
      await requestFamilyNominee(nomineeId);
      setMessage('Nominee request sent. It will take effect after admin approval.');
      await load();
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setFormError(failure.message || 'Could not submit the nominee request.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <section className="member-hub__panel" aria-labelledby="family-dashboard-title">
    <h2 id="family-dashboard-title">Family</h2>
    <p className="member-hub__loading" role="status">Loading your family…</p>
  </section>;

  if (error) return <section className="member-hub__panel" aria-labelledby="family-dashboard-title">
    <h2 id="family-dashboard-title">Family</h2>
    <div className="member-hub__error" role="alert">{error}</div>
    <button className="member-hub__retry" type="button" onClick={load}>Try again</button>
  </section>;

  return <section className="member-hub__panel" aria-labelledby="family-dashboard-title">
    <h2 id="family-dashboard-title">Family</h2>
    <p className="member-hub__subtle">Changes are requests and need admin approval.</p>
    <p><strong>{numberFormat.format(count)} of {numberFormat.format(limit)} members</strong></p>
    {atLimit && <p className="member-hub__warning" role="status">
      Your family has reached the {limit}-member limit. You cannot add another member until a place is available.
    </p>}
    {message && <p className="member-hub__warning" role="status">{message}</p>}
    {formError && <p className="member-hub__error" role="alert">{formError}</p>}

    {['adults', 'children'].map((group) => {
      const members = family[group];
      const type = group === 'adults' ? 'adult' : 'child';
      return <section key={group} aria-labelledby={`family-${group}-title`}>
        <h3 id={`family-${group}-title`}>{group === 'adults' ? 'Adults' : 'Children'}</h3>
        {members.length === 0
          ? <p className="member-hub__empty">No {group} listed.</p>
          : <div className="member-hub__cards" style={{ display: 'grid', gap: 12 }}>
            {members.map((member) => <FamilyMemberCard
              key={member.id || member._id}
              member={member}
              type={type}
              activeAdultCount={activeAdultCount}
              currentNomineeId={membership?.nominee?.id}
              onRemove={onRemove}
              saving={saving}
            />)}
          </div>}
      </section>;
    })}

    <section aria-labelledby="family-add-title">
      <h3 id="family-add-title">Request to add a member</h3>
      {atLimit
        ? <p className="member-hub__subtle">The member limit must be available before a new request can be submitted.</p>
        : <form className="member-hub__filters" onSubmit={onSubmit}>
          <label>Name<input name="name" autoComplete="name" maxLength={120} required /></label>
          <label>Relation<input name="relation" maxLength={40} required /></label>
          <label>Date of birth<input name="dateOfBirth" type="date" required /></label>
          <label>Phone<input name="phone" type="tel" autoComplete="tel" maxLength={40} required /></label>
          <label>Photo (optional; JPG, PNG, or WebP, up to 10 MB)
            <input name="photo" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" />
          </label>
          <button className="member-hub__retry" type="submit" disabled={saving}>
            {saving ? 'Submitting…' : 'Submit add-member request'}
          </button>
        </form>}
    </section>

    <section aria-labelledby="family-nominee-title">
      <h3 id="family-nominee-title">Request nominee</h3>
      <p className="member-hub__subtle">Only existing active adults can be nominated; children cannot be nominees.</p>
      {activeAdults.length === 0
        ? <p className="member-hub__empty">There are no active adult family members to choose.</p>
        : <form className="member-hub__filters" onSubmit={onNomineeSubmit}>
          <label>Active adult
            <select value={nomineeId} onChange={(event) => setNomineeId(event.target.value)} required>
              <option value="" disabled>Choose an adult</option>
              {activeAdults.map((adult) => {
                const id = String(adult.id || adult._id);
                return <option key={id} value={id}>{adult.name || adult.fullName}</option>;
              })}
            </select>
          </label>
          <button className="member-hub__retry" type="submit" disabled={saving || !nomineeId}>
            {saving ? 'Submitting…' : 'Submit nominee request'}
          </button>
        </form>}
      {allMembers.some((member) => member.pendingAction === 'nominee')
        && <p className="member-hub__subtle">A nominee request is pending admin approval.</p>}
    </section>
  </section>;
}
