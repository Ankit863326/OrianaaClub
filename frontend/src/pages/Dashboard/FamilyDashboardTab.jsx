import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImageUrl } from '../../config/api.js';
import useAuth from '../../context/useAuth.js';
import { getMyMembership } from './memberDashboardApi.js';
import {
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

function FamilyMemberCard({ member, type, activeAdultCount, currentNomineeId, onRemove, onVerify, saving }) {
  const photo = member.photo || member.photoUrl;
  const memberId = String(member.id || member._id);
  const isNominee = member.isNominee || memberId === String(currentNomineeId);
  const verificationStatus = member.verificationStatus || 'not_added';
  const familyMembershipPaid = member.memberStatus === 'pending_approval'
    || member.memberStatus === 'active'
    || Boolean(member.paymentConfirmedAt || member.memberNo);
  const isApprovedMember = member.memberStatus === 'active' && !isNominee;
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
      {member.memberNo && <div><dt>Member number</dt><dd>{member.memberNo}</dd></div>}
      {isApprovedMember && Number.isSafeInteger(member.pointsBalance)
        && <div><dt>Points</dt><dd>{numberFormat.format(member.pointsBalance)}</dd></div>}
      {!isNominee && <div><dt>Aadhaar status</dt><dd>{verificationStatus.replaceAll('_', ' ')}</dd></div>}
    </dl>
    <div className="member-hub__badges">
      <StatusChip status={member.status} pendingAction={member.pendingAction} />
      {isNominee
        ? <span className="member-hub__badge member-hub__badge--gold">Nominee</span>
        : null}
      {!isNominee && <span className="member-hub__badge">
        {verificationStatus === 'verified'
          ? 'Verified'
          : verificationStatus === 'pending'
            ? 'Verification under review'
            : verificationStatus === 'rejected'
              ? 'Re-upload required'
              : 'Not verified'}
      </span>}
      {isNominee && <span className="member-hub__badge">
        {member.emailConfirmedAt ? 'Email confirmed' : 'Email not confirmed'}
      </span>}
    </div>
    {!member.isPrimary
      && (isNominee || (!familyMembershipPaid && member.status !== 'pending_approval'))
      && member.pendingAction !== 'remove'
      && <button
        className="member-hub__retry"
        type="button"
        disabled={saving}
        onClick={() => onVerify(member, isNominee, verificationStatus)}
      >{isNominee
        ? member.emailConfirmedAt ? 'View' : 'Confirm email'
        : familyMembershipPaid ? 'View membership status'
          : verificationStatus === 'pending' ? 'View'
            : verificationStatus === 'rejected' ? 'Upload'
              : verificationStatus === 'verified' ? 'Join membership' : 'Join membership'}</button>}
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

  function onVerify(member, isNominee, verificationStatus) {
    const familyId = member.id || member._id;
    if (!isNominee && verificationStatus === 'verified') {
      navigate(`/dashboard/family/${encodeURIComponent(familyId)}/payment`);
      return;
    }
    navigate(`/dashboard/family/${encodeURIComponent(familyId)}/verification`);
  }

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
      const membershipResult = await getMyMembership();
      const familyResult = membershipResult?.family || { adults: [], children: [], nominees: [] };
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
      if (failure.status === 404) {
        setFamily({ adults: [], children: [] });
        setMembership(null);
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
  const count = allMembers.filter((member) => ['active', 'payment_pending', 'pending_approval'].includes(member.status)
    && member.pendingAction !== 'remove' && !member.isNominee).length;
  const activeAdultCount = family.adults.filter((member) => member.status === 'active'
    && member.pendingAction !== 'remove' && !member.isNominee).length;
  const activeAdults = family.adults.filter((member) => member.status === 'active' && !member.pendingAction && !member.isNominee);
  const nominees = useMemo(() => {
    const selectedId = String(membership?.nominee?.id || '');
    return [
      ...(membership?.family?.nominees || []),
      ...allMembers.filter((member) => member.isNominee || String(member.id || member._id) === selectedId),
    ].filter((member, index, values) => values.findIndex((item) => String(item.id || item._id) === String(member.id || member._id)) === index);
  }, [allMembers, membership]);
  const familyPolicy = membership?.familyPolicy || {
    enabled: true,
    discounts: { spouse: 50, parent: 50, child: 75 },
    limits: { spouse: 1, parents: 4 },
  };
  const spouseCount = allMembers.filter((member) => ['spouse', 'wife', 'husband'].includes(String(member.relation || '').toLowerCase()) && member.status !== 'removed').length;
  const parentCount = allMembers.filter((member) => ['father', 'mother'].includes(String(member.relation || '').toLowerCase()) && member.status !== 'removed').length;
  const canManageFamily = membership?.status === 'active' && familyPolicy.enabled;

  function scrollToAddForm() {
    document.getElementById('family-add-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
    <h2 id="family-dashboard-title">Family and nominees</h2>
    <p className="member-hub__loading" role="status">Loading your family…</p>
  </section>;

  if (error) return <section className="member-hub__panel" aria-labelledby="family-dashboard-title">
    <h2 id="family-dashboard-title">Family and nominees</h2>
    <div className="member-hub__error" role="alert">{error}</div>
    <button className="member-hub__retry" type="button" onClick={load}>Try again</button>
  </section>;

  return <section className="member-hub__panel" aria-labelledby="family-dashboard-title">
    <h2 id="family-dashboard-title">Family and nominees</h2>
    {membership?.status === 'pending_approval' && <p className="member-hub__warning" role="status">Payment received. Your membership is under review.</p>}
    {['pending_payment', 'payment_pending'].includes(membership?.status) && <p className="member-hub__warning" role="status">Your membership is awaiting payment. Family membership actions will be available after payment is confirmed.</p>}
    {!membership && <p className="member-hub__empty">Your family and nominees will appear here after you start a membership.</p>}
    {membership && <p className="member-hub__subtle">Changes are requests and need admin approval.</p>}
    {membership && <p><strong>{numberFormat.format(count)} family profiles</strong></p>}
    {message && <p className="member-hub__warning" role="status">{message}</p>}
    {formError && <p className="member-hub__error" role="alert">{formError}</p>}

    {familyPolicy.enabled && <section aria-labelledby="family-open-slots-title">
      <h3 id="family-open-slots-title">Open family slots</h3>
      <div className="member-hub__family-slots">
        {spouseCount < Number(familyPolicy.limits?.spouse ?? 1) && <article className="member-hub__family-slot">
          <strong>Spouse</strong><span className="member-hub__badge">50% discount</span>
          <button className="member-hub__retry" type="button" disabled={!canManageFamily} onClick={scrollToAddForm}>Add</button>
        </article>}
        {parentCount < Number(familyPolicy.limits?.parents ?? 4) && <article className="member-hub__family-slot">
          <strong>Parents · up to {familyPolicy.limits?.parents ?? 4}</strong><span className="member-hub__badge">50% discount</span>
          <button className="member-hub__retry" type="button" disabled={!canManageFamily} onClick={scrollToAddForm}>Add</button>
        </article>}
        <article className="member-hub__family-slot">
          <strong>Children · no limit</strong><span className="member-hub__badge">75% discount</span>
          <button className="member-hub__retry" type="button" disabled={!canManageFamily} onClick={scrollToAddForm}>Add</button>
        </article>
      </div>
    </section>}

    {familyPolicy.enabled && ['adults', 'children'].map((group) => {
      const members = family[group];
      const type = group === 'adults' ? 'adult' : 'child';
      const familyMembers = members.filter((member) => !member.isNominee
        && String(member.id || member._id) !== String(membership?.nominee?.id || ''));
      return <section key={group} aria-labelledby={`family-${group}-title`}>
        <h3 id={`family-${group}-title`}>{group === 'adults' ? 'Adults' : 'Children'}</h3>
        {familyMembers.length === 0
          ? <p className="member-hub__empty">No {group} listed.</p>
          : <div className="member-hub__cards" style={{ display: 'grid', gap: 12 }}>
            {familyMembers.map((member) => <FamilyMemberCard
              key={member.id || member._id}
              member={member}
              type={type}
              activeAdultCount={activeAdultCount}
              currentNomineeId={membership?.nominee?.id}
              onRemove={onRemove}
              onVerify={onVerify}
              saving={saving}
            />)}
          </div>}
      </section>;
    })}

    <section aria-labelledby="family-nominees-title">
      <h3 id="family-nominees-title">Nominees</h3>
      {nominees.length
        ? <div className="member-hub__cards" style={{ display: 'grid', gap: 12 }}>
          {nominees.map((nominee) => <article className="member-hub__bill-card" key={nominee.id || nominee._id}>
            <strong>{nominee.name || nominee.fullName || 'Nominee'}</strong>
            <dl>
              <div><dt>Role</dt><dd>{nominee.nomineeRole || nominee.designation || 'Nominee'}</dd></div>
              {nominee.memberNo && <div><dt>Member number</dt><dd>{nominee.memberNo}</dd></div>}
              <div><dt>Email</dt><dd>{nominee.emailConfirmed || nominee.emailConfirmedAt ? 'Confirmed' : 'Not confirmed'}</dd></div>
              <div><dt>Points</dt><dd>No points</dd></div>
            </dl>
            {!(nominee.emailConfirmed || nominee.emailConfirmedAt) && <button
              className="member-hub__retry"
              type="button"
              onClick={() => onVerify(nominee, true, nominee.verificationStatus)}
            >Confirm email</button>}
          </article>)}
        </div>
        : <p className="member-hub__empty">No nominees added yet.</p>}
    </section>

    {canManageFamily && <section aria-labelledby="family-add-title">
      <h3 id="family-add-title">Request to add a member</h3>
      <form className="member-hub__filters" onSubmit={onSubmit}>
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
      </form>
    </section>}

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
  </section>
}
