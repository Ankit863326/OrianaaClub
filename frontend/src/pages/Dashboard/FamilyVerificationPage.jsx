import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../../context/useAuth.js';
import {
  confirmFamilyEmailCode,
  getFamilyCheckoutQuote,
  getFamilyVerification,
  saveFamilyVerificationDraft,
  sendFamilyEmailCode,
  submitFamilyVerificationDocuments,
} from '../../lib/familyMembershipApi.js';
import { getMyFamily } from './memberDashboardActionsApi.js';
import './FamilyVerificationPage.css';

const documentTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
const maxDocumentBytes = 5 * 1024 * 1024;
const formatINR = (amount) => `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Number(amount) || 0)}`;
const relationOptions = [
  ['wife', 'Wife'],
  ['husband', 'Husband'],
  ['son', 'Son'],
  ['daughter', 'Daughter'],
  ['father', 'Father'],
  ['mother', 'Mother'],
];

function relationForProfile(member) {
  const relation = String(member?.relation || member?.relationship || '').trim().toLowerCase();
  if (relationOptions.some(([value]) => value === relation)) return relation;
  if (['spouse', 'partner'].includes(relation)) return member?.gender === 'male' ? 'husband' : 'wife';
  if (['child', 'son', 'daughter'].includes(relation)) {
    if (relation === 'son' || relation === 'daughter') return relation;
    return member?.gender === 'male' ? 'son' : 'daughter';
  }
  return 'wife';
}

function apiMessage(failure, fallback) {
  if (failure.status === 400 && /expired|invalid|attempt limit/i.test(failure.message || '')) {
    return 'That code has expired or can no longer be used. Request a new code and try again.';
  }
  return failure.message || fallback;
}

function ErrorNotice({ children }) {
  return <div className="family-verify__alert" role="alert">{children}</div>;
}

function EmailCodeStep({
  isNominee,
  codeSentTo,
  codeSent,
  code,
  setCode,
  remainingAttempts,
  resendSeconds,
  loading,
  onSend,
  onConfirm,
  error,
}) {
  return <section className="family-verify__card" aria-labelledby="family-email-title">
    <p className="family-verify__eyebrow">{isNominee ? 'Nominee email' : 'Step 1 of 3 · Confirm email'}</p>
    <h2 id="family-email-title">{isNominee ? 'Confirm your email' : 'Confirm the family member’s email'}</h2>
    <p>
      {isNominee
        ? 'We’ll send a six-digit confirmation code to the nominee’s work email. No documents are needed.'
        : codeSentTo === 'primary'
          ? 'The code was sent to your email, as guardian or helper.'
          : codeSentTo === 'own'
            ? 'The code was sent to the family member’s own email address.'
            : 'We’ll send a six-digit code by email only.'}
    </p>
    <p className="family-verify__subtle">The code is valid for 10 minutes. You have {remainingAttempts} attempt{remainingAttempts === 1 ? '' : 's'} remaining.</p>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    {!codeSent ? <button className="family-verify__button" type="button" disabled={loading} onClick={onSend}>
      {loading ? 'Sending…' : 'Send email code'}
    </button> : <form onSubmit={onConfirm} className="family-verify__form">
      <label htmlFor="family-email-code">Six-digit email code</label>
      <input
        id="family-email-code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        required
      />
      <button className="family-verify__button" type="submit" disabled={loading || code.length !== 6 || remainingAttempts === 0}>
        {loading ? 'Confirming…' : 'Confirm email'}
      </button>
      <button
        className="family-verify__secondary"
        type="button"
        disabled={loading || resendSeconds > 0}
        onClick={onSend}
      >{resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : 'Resend code'}</button>
    </form>}
  </section>;
}

function FamilyDocumentStep({
  member,
  relation,
  setRelation,
  parentSide,
  setParentSide,
  docType,
  setDocType,
  extraDocType,
  setExtraDocType,
  nameOnDocument,
  setNameOnDocument,
  relationLine,
  setRelationLine,
  applicantAddress,
  setApplicantAddress,
  files,
  onFile,
  aadhaarNumber,
  setAadhaarNumber,
  loading,
  error,
  notice,
  onSave,
  onSubmit,
}) {
  const needsExtraDocument = relation === 'husband' || relation === 'mother';
  const extraDocumentLabel = relation === 'husband'
    ? 'Marriage certificate'
    : 'Birth certificate or family card listing the mother';

  return <section className="family-verify__card" aria-labelledby="family-document-title">
    <p className="family-verify__eyebrow">Step 2 of 3 · Documents</p>
    <h2 id="family-document-title">Verify {member.name || member.fullName || 'your family member'}</h2>
    <p>Use DigiLocker where available. A clear PDF, JPG, or PNG file is accepted (up to 5 MB).</p>
    {error && <ErrorNotice>{error}</ErrorNotice>}
    {notice && <p className="family-verify__notice" role="status">{notice}</p>}
    <form className="family-verify__form" onSubmit={onSubmit}>
      <label htmlFor="family-relation">Who is joining?</label>
      <select id="family-relation" value={relation} onChange={(event) => setRelation(event.target.value)}>
        {relationOptions.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
      </select>

      {['father', 'mother'].includes(relation) && <fieldset className="family-verify__fieldset">
        <legend>Which side of the family?</legend>
        <label><input type="radio" name="parent-side" value="member" checked={parentSide === 'member'} onChange={() => setParentSide('member')} /> Member’s parent</label>
        <label><input type="radio" name="parent-side" value="spouse" checked={parentSide === 'spouse'} onChange={() => setParentSide('spouse')} /> Spouse’s parent</label>
      </fieldset>}

      <fieldset className="family-verify__fieldset">
        <legend>Choose a document source</legend>
        <label className="family-verify__radio">
          <input type="radio" name="doc-type" value="aadhaar_digilocker" checked={docType === 'aadhaar_digilocker'} onChange={() => setDocType('aadhaar_digilocker')} />
          DigiLocker (recommended)
        </label>
        <label className="family-verify__radio">
          <input type="radio" name="doc-type" value="aadhaar_upload" checked={docType === 'aadhaar_upload'} onChange={() => setDocType('aadhaar_upload')} />
          Aadhaar document upload
        </label>
      </fieldset>

      <label htmlFor="family-aadhaar">Aadhaar number for duplicate checking</label>
      <input
        id="family-aadhaar"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        pattern="[0-9]{12}"
        value={aadhaarNumber}
        onChange={(event) => setAadhaarNumber(event.target.value.replace(/\D/g, '').slice(0, 12))}
        required
      />
      <p className="family-verify__subtle">The full number is used only for secure duplicate checking. The system stores its salted hash and last four digits, not the full number.</p>

      <label htmlFor="family-document">{docType === 'aadhaar_digilocker' ? 'DigiLocker document file' : 'Aadhaar document file'} (PDF, JPG, or PNG; max 5 MB)</label>
      <input
        id="family-document"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={(event) => onFile('document', event)}
        required={!files.document}
      />
      {files.document && <span className="family-verify__file">{files.document.name}</span>}

      {needsExtraDocument && <>
        <p className="family-verify__notice">
          {relation === 'husband'
            ? 'A marriage certificate is also required to confirm the relationship; Aadhaar alone does not establish it.'
            : 'A birth certificate or family card listing the mother is also required; Aadhaar alone does not establish the relationship.'}
        </p>
        <label htmlFor="family-extra-type">{extraDocumentLabel}</label>
        <select id="family-extra-type" value={extraDocType} onChange={(event) => setExtraDocType(event.target.value)} required>
          <option value="">Choose a document</option>
          {relation === 'husband'
            ? <option value="marriage_certificate">Marriage certificate</option>
            : <>
              <option value="birth_certificate">Birth certificate</option>
              <option value="family_card">Family card</option>
            </>}
        </select>
        <label htmlFor="family-extra-document">Upload {extraDocumentLabel.toLowerCase()} (PDF, JPG, or PNG; max 5 MB)</label>
        <input
          id="family-extra-document"
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          onChange={(event) => onFile('extraDocument', event)}
          required={!files.extraDocument}
        />
        {files.extraDocument && <span className="family-verify__file">{files.extraDocument.name}</span>}
      </>}

      <label htmlFor="family-name-on-document">Name shown on document (optional)</label>
      <input id="family-name-on-document" value={nameOnDocument} onChange={(event) => setNameOnDocument(event.target.value)} maxLength={120} />
      <label htmlFor="family-relation-line">Relationship line shown on document (optional)</label>
      <input id="family-relation-line" value={relationLine} onChange={(event) => setRelationLine(event.target.value)} maxLength={240} />
      <label htmlFor="family-address">Applicant address (optional)</label>
      <textarea id="family-address" value={applicantAddress} onChange={(event) => setApplicantAddress(event.target.value)} maxLength={1000} rows={3} />

      <p className="family-verify__notice">Payment is non-refundable if verification cannot be completed.</p>
      <div className="family-verify__actions">
        <button className="family-verify__secondary" type="button" disabled={loading} onClick={onSave}>
          {loading ? 'Saving…' : 'Save and finish later'}
        </button>
        <button className="family-verify__button" type="submit" disabled={loading}>
          {loading ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </form>
  </section>;
}

export default function FamilyVerificationPage() {
  const { familyId } = useParams();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [member, setMember] = useState(null);
  const [verification, setVerification] = useState(null);
  const [checkoutQuote, setCheckoutQuote] = useState(null);
  const [phase, setPhase] = useState('loading');
  const [relation, setRelation] = useState('wife');
  const [parentSide, setParentSide] = useState('');
  const [docType, setDocType] = useState('aadhaar_digilocker');
  const [extraDocType, setExtraDocType] = useState('');
  const [nameOnDocument, setNameOnDocument] = useState('');
  const [relationLine, setRelationLine] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [files, setFiles] = useState({ document: null, extraDocument: null });
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [codeSentTo, setCodeSentTo] = useState('');
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const handleSessionExpired = useCallback(async () => {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }, [logout, navigate]);

  const load = useCallback(async () => {
    setPhase('loading');
    setError('');
    try {
      const [family, status] = await Promise.all([
        getMyFamily(),
        getFamilyVerification(familyId),
      ]);
      const people = [...(family?.adults || []), ...(family?.children || [])];
      const profile = people.find((person) => String(person.id || person._id) === String(familyId));
      if (!profile) {
        setError('This family profile is not available in your account.');
        setPhase('error');
        return;
      }
      setMember(profile);
      setVerification(status);
      setCodeSent(Boolean(status?.codeSent));
      setCodeSentTo(status?.codeSentTo || status?.verification?.codeSentTo || '');
      setRemainingAttempts(Number.isInteger(status?.remainingAttempts) ? status.remainingAttempts : 5);
      setResendSeconds(Number.isInteger(status?.resendAfterSeconds) ? status.resendAfterSeconds : 0);
      setRelation(relationForProfile(profile));
      setParentSide(profile.parentSide || '');
      setDocType(status?.verification?.docType || 'aadhaar_digilocker');
      setExtraDocType(status?.verification?.extraDocType || '');
      setNameOnDocument(status?.verification?.nameOnDocument || '');
      setRelationLine(status?.verification?.relationLine || '');
      setApplicantAddress(status?.verification?.applicantAddress || '');
      if (profile.isNominee || status?.nominee) {
        setPhase(status?.emailConfirmed ? 'nominee-confirmed' : 'email');
      } else if (profile.paymentConfirmedAt || profile.status === 'pending_approval' || profile.memberNo) {
        setPhase('payment-pending');
      } else if (status?.verification?.status === 'verified') {
        setPhase('verified');
        setCheckoutQuote(null);
        try {
          setCheckoutQuote(await getFamilyCheckoutQuote(familyId));
        } catch (failure) {
          if (failure.status === 401) {
            await handleSessionExpired();
            return;
          }
          setError(failure.message || 'Could not load the approved family rate.');
        }
      } else if (status?.verification?.status === 'pending') {
        setPhase('review');
      } else if (status?.verification?.status === 'rejected') {
        setPhase('rejected');
      } else if (status?.verification?.emailConfirmed) {
        setPhase('documents');
      } else {
        setPhase('email');
      }
    } catch (failure) {
      if (failure.status === 401) {
        await handleSessionExpired();
        return;
      }
      setError(failure.message || 'Could not load the family verification details.');
      setPhase('error');
    }
  }, [familyId, handleSessionExpired]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!resendSeconds) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  const isNominee = Boolean(member?.isNominee || verification?.nominee);
  const memberRelation = useMemo(() => String(member?.relation || member?.relationship || ''), [member]);

  async function sendCode() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const result = await sendFamilyEmailCode(familyId);
      setCodeSent(true);
      setCodeSentTo(result.codeSentTo || 'own');
      setRemainingAttempts(5);
      setCode('');
      setResendSeconds(30);
      setNotice('A six-digit code was sent by email. It is valid for 10 minutes.');
    } catch (failure) {
      if (failure.status === 401) return handleSessionExpired();
      if (failure.status === 429) setResendSeconds((seconds) => Math.max(seconds, 30));
      setError(failure.message || 'Could not send the email code.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmCode(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await confirmFamilyEmailCode(familyId, code);
      if (result.nominee) {
        setVerification((current) => ({ ...current, nominee: true, emailConfirmed: true }));
        setPhase('nominee-confirmed');
      } else {
        setVerification((current) => ({
          ...current,
          verification: { ...(current?.verification || {}), emailConfirmed: true },
        }));
        setPhase('documents');
      }
    } catch (failure) {
      if (failure.status === 401) return handleSessionExpired();
      const message = failure.message || '';
      if (/incorrect/i.test(message)) {
        const attempts = Math.max(0, remainingAttempts - 1);
        setRemainingAttempts(attempts);
        setError(attempts
          ? `That code is incorrect. You have ${attempts} attempt${attempts === 1 ? '' : 's'} remaining.`
          : 'The attempt limit has been reached. Request a new code to continue.');
      } else {
        setError(apiMessage(failure, 'Could not confirm the email code.'));
      }
    } finally {
      setLoading(false);
    }
  }

  function chooseFile(field, event) {
    const file = event.target.files?.[0] || null;
    event.target.value = '';
    if (file && !documentTypes.has(file.type)) {
      setError('Choose a PDF, JPG, or PNG document.');
      return;
    }
    if (file && file.size > maxDocumentBytes) {
      setError('Each document must be 5 MB or smaller.');
      return;
    }
    setError('');
    setFiles((current) => ({ ...current, [field]: file }));
  }

  function draftValues() {
    return {
      relation,
      docType,
      extraDocType,
      nameOnDocument,
      relationLine,
      applicantAddress,
      ...(parentSide ? { parentSide } : {}),
    };
  }

  async function saveDraft() {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      await saveFamilyVerificationDraft(familyId, draftValues());
      setNotice('Your draft was saved. You can return to finish verification later.');
    } catch (failure) {
      if (failure.status === 401) return handleSessionExpired();
      setError(failure.message || 'Could not save your verification draft.');
    } finally {
      setLoading(false);
    }
  }

  async function submitDocuments(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setNotice('');
    if (!/^\d{12}$/.test(aadhaarNumber)) {
      setError('Enter the 12-digit Aadhaar number for secure duplicate checking.');
      setLoading(false);
      return;
    }
    if (!files.document) {
      setError('Choose the primary verification document.');
      setLoading(false);
      return;
    }
    if (['husband', 'mother'].includes(relation) && !files.extraDocument) {
      setError(`Upload the required ${relation === 'husband' ? 'marriage certificate' : 'birth certificate or family card'}.`);
      setLoading(false);
      return;
    }
    try {
      const result = await submitFamilyVerificationDocuments(familyId, {
        ...draftValues(),
        aadhaarNumber,
      }, files);
      setVerification((current) => ({ ...current, verification: result }));
      setAadhaarNumber('');
      setFiles({ document: null, extraDocument: null });
      setPhase('review');
    } catch (failure) {
      if (failure.status === 401) return handleSessionExpired();
      setError(failure.message || 'Could not submit documents for review.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="family-verify">
    <div className="family-verify__inner">
      <Link className="family-verify__back" to="/dashboard?tab=Family">← Back to Family</Link>
      <p className="family-verify__eyebrow">ORI A N A A  C L U B · FAMILY</p>
      <h1>Family verification</h1>
      <p className="family-verify__intro">
        {member ? `${member.name || member.fullName || 'Family member'} · ${memberRelation || 'Family profile'}` : 'Securely verify a family profile.'}
      </p>

      {phase === 'loading' && <p className="family-verify__loading" role="status">Loading verification details…</p>}
      {phase === 'error' && <section className="family-verify__card">
        <ErrorNotice>{error || 'This family profile could not be loaded.'}</ErrorNotice>
        <button className="family-verify__secondary" type="button" onClick={load}>Try again</button>
      </section>}

      {phase === 'email' && <EmailCodeStep
        isNominee={isNominee}
        codeSentTo={codeSentTo}
        codeSent={codeSent}
        code={code}
        setCode={setCode}
        remainingAttempts={remainingAttempts}
        resendSeconds={resendSeconds}
        loading={loading}
        onSend={sendCode}
        onConfirm={confirmCode}
        error={error || notice}
      />}

      {phase === 'documents' && member && <FamilyDocumentStep
        member={member}
        relation={relation}
        setRelation={setRelation}
        parentSide={parentSide}
        setParentSide={setParentSide}
        docType={docType}
        setDocType={setDocType}
        extraDocType={extraDocType}
        setExtraDocType={setExtraDocType}
        nameOnDocument={nameOnDocument}
        setNameOnDocument={setNameOnDocument}
        relationLine={relationLine}
        setRelationLine={setRelationLine}
        applicantAddress={applicantAddress}
        setApplicantAddress={setApplicantAddress}
        files={files}
        onFile={chooseFile}
        aadhaarNumber={aadhaarNumber}
        setAadhaarNumber={setAadhaarNumber}
        loading={loading}
        error={error}
        notice={notice}
        onSave={saveDraft}
        onSubmit={submitDocuments}
      />}

      {phase === 'review' && <section className="family-verify__card" aria-labelledby="family-review-title">
        <p className="family-verify__eyebrow">Step 3 of 3 · Review</p>
        <h2 id="family-review-title">Submitted for review</h2>
        <p>We review family documents within one working day. You can leave this page; the status will appear in the Family tab.</p>
        <p className="family-verify__status">Status: Under review</p>
        <button className="family-verify__secondary" type="button" onClick={load}>Refresh status</button>
      </section>}

      {phase === 'rejected' && <section className="family-verify__card" aria-labelledby="family-rejected-title">
        <p className="family-verify__eyebrow">Verification update</p>
        <h2 id="family-rejected-title">Another document is needed</h2>
        <p>{verification?.verification?.rejectionReason || 'The submitted documents could not be verified. Please upload a new document for review.'}</p>
        <p className="family-verify__notice">If verification cannot be completed, payment is non-refundable.</p>
        <button className="family-verify__button" type="button" onClick={() => setPhase('documents')}>Re-upload documents</button>
      </section>}

      {phase === 'verified' && <section className="family-verify__card" aria-labelledby="family-verified-title">
        <p className="family-verify__eyebrow">Step 4 · Verified</p>
        <h2 id="family-verified-title">Family verification complete</h2>
        <p>The approved family rate is unlocked. Continue to the secure payment page to review the full amount.</p>
        {checkoutQuote && <dl className="family-verify__price">
          <div><dt>Discounted base</dt><dd>{formatINR(checkoutQuote.baseAmount)}</dd></div>
          <div><dt>GST</dt><dd>{formatINR(checkoutQuote.gstAmount)}</dd></div>
          <div className="family-verify__price-total"><dt>Total payable</dt><dd>{formatINR(checkoutQuote.totalPayable)}</dd></div>
        </dl>}
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <button
          className="family-verify__button"
          type="button"
          onClick={() => navigate(`/dashboard/family/${encodeURIComponent(familyId)}/payment`)}
        >Continue to payment</button>
      </section>}

      {phase === 'payment-pending' && <section className="family-verify__card" aria-labelledby="family-payment-pending-title">
        <p className="family-verify__eyebrow">Payment received</p>
        <h2 id="family-payment-pending-title">Membership awaiting approval</h2>
        <p>The family membership payment has been received. You can follow its status in the Family tab.</p>
      </section>}

      {phase === 'nominee-confirmed' && <section className="family-verify__card" aria-labelledby="nominee-confirmed-title">
        <p className="family-verify__eyebrow">Nominee email</p>
        <h2 id="nominee-confirmed-title">Nominee confirmed.</h2>
        <p>The nominee’s email has been confirmed. No documents or payment are required for a nominee.</p>
        <Link className="family-verify__secondary-link" to="/dashboard?tab=Family">Return to Family</Link>
      </section>}
    </div>
  </main>;
}
