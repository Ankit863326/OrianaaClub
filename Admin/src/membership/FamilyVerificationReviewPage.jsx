import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errorMessage } from '../api/client.js';
import {
  Button,
  FormField,
  LoadingState,
  PageHeading,
  Panel,
  Toast,
  controlClass,
  formatDate,
} from '../components/ui.jsx';
import { membershipApi } from '../api/membership.js';
import { formatMemberCode } from './formatters.js';

const checkLabels = [
  ['contactConfirmed', 'Contact confirmed'],
  ['nameMatchesProfile', 'Name matches profile'],
  ['relationLineMatchesPrimary', 'Relation line matches primary'],
  ['addressMatches', 'Address matches'],
  ['childAge', 'Age 18 or under (child)'],
  ['aadhaarHashUnique', 'Aadhaar not used by another member'],
  ['extraDocumentPresent', 'Extra document present when required'],
];

const rejectionReasons = [
  'Select a reason',
  'Document is unreadable',
  'Name does not match the profile',
  'Relation details do not match',
  'Address could not be verified',
  'Required supporting document is missing',
  'Other',
];

function memberCode(value) {
  return formatMemberCode(value);
}

function relationHint(relation, parentSide) {
  if (relation === 'wife') return 'Check that the document relation line shows W/O and matches the primary member.';
  if (relation === 'husband') return 'A marriage certificate is required in addition to identity verification.';
  if (relation === 'child') return 'Check S/O or D/O against the primary member and compare the date of birth.';
  if (relation === 'father') {
    return parentSide === 'spouse'
      ? 'For the spouse’s father, check the spouse’s family card and confirm the relation to the spouse.'
      : 'Check the primary member’s family card and confirm the relation to the primary.';
  }
  if (relation === 'mother') return 'A birth certificate or family card listing the mother is required.';
  return 'Compare the submitted relationship and documents with the primary profile.';
}

function statusStyle(status) {
  if (status === 'ok') return { mark: 'bg-emerald-600', text: 'OK', tone: 'text-emerald-800' };
  if (status === 'fail') return { mark: 'bg-red-600', text: 'FAIL', tone: 'text-red-800' };
  return { mark: 'bg-amber-500', text: 'WARNING', tone: 'text-amber-800' };
}

function documentToken(url) {
  if (!url) return '';
  try {
    return new URL(url, window.location.origin).searchParams.get('token') || '';
  } catch {
    return '';
  }
}

export default function FamilyVerificationReviewPage() {
  const { familyId } = useParams();
  const [detail, setDetail] = useState(null);
  const [documentUrls, setDocumentUrls] = useState({ document: '', extra: '' });
  const [reasonPreset, setReasonPreset] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setDocumentUrls({ document: '', extra: '' });
    try {
      const result = await membershipApi.familyVerification(familyId);
      setDetail(result);
      const documentTokenValue = documentToken(result.verification?.documentUrl);
      const extraTokenValue = documentToken(result.verification?.extraDocumentUrl);
      const [documentResponse, extraResponse] = await Promise.all([
        documentTokenValue ? membershipApi.familyVerificationDocument(documentTokenValue) : null,
        extraTokenValue ? membershipApi.familyVerificationDocument(extraTokenValue) : null,
      ]);
      setDocumentUrls({
        document: documentResponse ? URL.createObjectURL(documentResponse.data) : '',
        extra: extraResponse ? URL.createObjectURL(extraResponse.data) : '',
      });
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }, [familyId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => () => {
    if (documentUrls.document) URL.revokeObjectURL(documentUrls.document);
    if (documentUrls.extra) URL.revokeObjectURL(documentUrls.extra);
  }, [documentUrls]);

  async function decide(decision) {
    const reason = [reasonPreset === 'Other' ? '' : reasonPreset, customReason.trim()]
      .filter(Boolean).join(': ');
    if (decision !== 'approve' && !reason) {
      setError('Choose a preset reason or enter a short explanation.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await membershipApi.decideFamilyVerification(familyId, decision, reason);
      setNotice(decision === 'approve'
        ? 'Verification approved. The family rate is now available and the member was emailed.'
        : decision === 'reject'
          ? 'Verification rejected. The member was emailed the reason and re-upload link.'
          : 'Another document was requested. The member was emailed the reason and re-upload link.');
      setDetail((current) => current ? {
        ...current,
        verification: {
          ...current.verification,
          status: result.status,
          rejectionReason: result.rejectionReason,
        },
      } : current);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const applicant = detail?.member;
  const verification = detail?.verification;
  const checks = detail?.checks || {};
  const maskedPrimaryNo = memberCode(detail?.primary?.memberNo);
  const status = verification?.status || 'not added';

  return <section>
    <PageHeading
      eyebrow="MEMBERSHIP VERIFICATION"
      title="Review family verification"
      description={applicant ? `${applicant.name} · ${applicant.relation}` : 'Review submitted family documents and verification checks.'}
      actions={<Link className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700" to="/membership/queue">Back to Pending Queue</Link>}
    />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {loading && !detail && <LoadingState />}
    {error && !detail && <Button variant="secondary" onClick={load}>Retry</Button>}
    {detail && <div className="grid gap-5">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.17em] text-gold">Applicant</p>
            <h2 className="mt-1 font-display text-2xl text-slate-900">{applicant?.name || 'Family member'}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {applicant?.relation || 'Family member'} of {maskedPrimaryNo || 'primary member'}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold capitalize text-slate-800">{String(status).replaceAll('_', ' ')}</span>
            {verification?.overdue && <span className="rounded-full bg-red-100 px-3 py-1.5 text-sm font-bold text-red-800">OVERDUE</span>}
          </div>
        </div>
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <strong>What to look for:</strong> {relationHint(applicant?.relation, applicant?.parentSide)}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <MaskedAadhaar title="Primary member Aadhaar" value={detail.primary?.aadhaar} />
          <MaskedAadhaar title="Applicant Aadhaar" value={verification?.aadhaar} />
        </div>
      </Panel>

      <Panel>
        <h2 className="mb-4 font-display text-xl">Automatic checks</h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {checkLabels.map(([key, label]) => {
            const result = checks[key];
            const style = statusStyle(result?.status);
            return <li key={key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3">
              <span className={`mt-1 size-3 shrink-0 rounded-full ${style.mark}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className={`text-xs font-bold tracking-wide ${style.tone}`}>{style.text} · {label}</p>
                <p className="mt-1 text-sm text-slate-700">{result?.detail || 'No result is available.'}</p>
              </div>
            </li>;
          })}
        </ul>
      </Panel>

      <div className={`grid gap-5 ${verification?.extraDocumentUrl ? 'xl:grid-cols-2' : ''}`}>
        <Panel>
          <h2 className="mb-3 font-display text-xl">Identity document</h2>
          <p className="mb-3 text-sm text-slate-500">
            {verification?.docType === 'aadhaar_digilocker' ? 'DigiLocker document' : 'Uploaded Aadhaar document'}
            {verification?.submittedAt ? ` · Submitted ${formatDate(verification.submittedAt)}` : ''}
          </p>
          <PrivateDocument url={documentUrls.document} mimeType={verification?.fileMimeType} label="Identity document" />
        </Panel>
        {verification?.extraDocumentUrl && <Panel>
          <h2 className="mb-3 font-display text-xl">Supporting document</h2>
          <p className="mb-3 text-sm text-slate-500">
            {verification.extraDocType === 'marriage_certificate'
              ? 'Marriage certificate'
              : verification.extraDocType === 'birth_certificate'
                ? 'Birth certificate'
                : verification.extraDocType === 'family_card' ? 'Family card' : 'Additional document'}
          </p>
          <PrivateDocument url={documentUrls.extra} mimeType={verification.extraDocMimeType} label="Supporting document" />
        </Panel>}
      </div>

      {verification?.rejectionReason && <Panel>
        <h2 className="font-display text-xl">Previous review reason</h2>
        <p className="mt-2 text-sm text-slate-700">{verification.rejectionReason}</p>
      </Panel>}

      {status === 'pending' && <Panel>
        <h2 className="mb-4 font-display text-xl">Review decision</h2>
        <div className="grid gap-4">
          <FormField label="Reason for rejection or additional document request">
            <select className={controlClass} value={reasonPreset} onChange={(event) => setReasonPreset(event.target.value)}>
              {rejectionReasons.map((reason) => <option key={reason} value={reason === 'Select a reason' ? '' : reason}>{reason}</option>)}
            </select>
          </FormField>
          <FormField label="Additional detail (optional)">
            <textarea
              className={controlClass}
              rows="3"
              maxLength="1000"
              value={customReason}
              onChange={(event) => setCustomReason(event.target.value)}
              placeholder={reasonPreset === 'Other' ? 'Enter the reason to send to the member' : 'Add a specific explanation'}
            />
          </FormField>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => decide('approve')}>Approve and release discount</Button>
            <Button variant="danger" disabled={busy} onClick={() => decide('reject')}>Reject with reason</Button>
            <Button variant="secondary" disabled={busy} onClick={() => decide('request-reupload')}>Ask for another document</Button>
          </div>
        </div>
      </Panel>}
    </div>}
  </section>;
}

function MaskedAadhaar({ title, value }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
    <p className="mt-1 font-mono text-lg font-semibold tracking-wider text-slate-900">{value || 'Not provided'}</p>
    <p className="mt-1 text-xs text-slate-500">Only the last four digits are displayed.</p>
  </div>;
}

function PrivateDocument({ url, mimeType, label }) {
  if (!url) return <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No document submitted.</p>;
  if (String(mimeType || '').startsWith('image/')) {
    return <img className="max-h-[32rem] w-full rounded-xl border border-slate-200 object-contain" src={url} alt={label} />;
  }
  return <iframe className="h-[32rem] w-full rounded-xl border border-slate-200" src={url} title={label} />;
}
