import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { errorMessage } from '../../api/client.js';
import {
  Button,
  ConfirmDialog,
  FormField,
  LoadingState,
  Panel,
  Toast,
  controlClass,
} from '../../components/ui.jsx';
import { membershipApi } from '../../api/membership.js';

function isPrivileged(plan) {
  return Number(plan?.sortOrder) === 8
    || String(plan?.name || plan?.title || '').toLowerCase().includes('privileged')
    || Boolean(plan?.requiresVerification);
}

function isCorporate(plan) {
  return Number(plan?.sortOrder) === 7
    || String(plan?.name || plan?.title || '').toLowerCase().includes('corporate')
    || Boolean(plan?.requiresCompanyDetails);
}

export default function DocumentsTab() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [identity, setIdentity] = useState(null);
  const [loadedDocuments, setLoadedDocuments] = useState([]);
  const [identityPreview, setIdentityPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [identityReason, setIdentityReason] = useState('');
  const [identityConfirmation, setIdentityConfirmation] = useState('');
  const documentUrls = useRef(new Set());

  const membership = data?.membership;
  const plan = membership?.plan;
  const companyDetails = data?.companyDetails || membership?.companyDetails || {};
  const documents = membership?.verificationDocs || [];
  const privileged = useMemo(() => isPrivileged(plan), [plan]);
  const corporate = useMemo(() => isCorporate(plan), [plan]);
  const awaitingVerification = membership?.status === 'pending_verification';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [membershipData, identityData] = await Promise.all([
        membershipApi.member(id),
        membershipApi.identityVerification(id),
      ]);
      setData(membershipData);
      setIdentity(identityData);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => () => {
    documentUrls.current.forEach((url) => URL.revokeObjectURL(url));
    documentUrls.current.clear();
  }, []);

  async function loadDocument(document) {
    setError('');
    try {
      const response = await membershipApi.verificationDocument(id, document.id);
      const url = URL.createObjectURL(response.data);
      documentUrls.current.add(url);
      setLoadedDocuments((current) => {
        const previous = current.find((item) => item.id === document.id);
        if (previous) {
          URL.revokeObjectURL(previous.url);
          documentUrls.current.delete(previous.url);
        }
        return [
          ...current.filter((item) => item.id !== document.id),
          {
            id: document.id,
            url,
            name: document.originalName || 'membership-proof',
          },
        ];
      });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function decideVerification() {
    if (confirmation === 'reject' && !rejectReason.trim()) {
      setError('A reason is required to reject verification.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (confirmation === 'approve') {
        await membershipApi.approveVerification(id);
        setNotice('Membership verification approved.');
      } else {
        await membershipApi.rejectVerification(id, rejectReason.trim());
        setNotice('Membership verification rejected.');
      }
      setConfirmation('');
      setRejectReason('');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function loadIdentityDocument(document) {
    setError('');
    try {
      const response = await membershipApi.identityDocument(id, document.id);
      const url = URL.createObjectURL(response.data);
      documentUrls.current.add(url);
      setIdentityPreview({
        url,
        mimeType: document.mimeType,
        name: document.kind.replaceAll('_', ' '),
      });
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  async function decideIdentityVerification() {
    if (identityConfirmation === 'rejected' && !identityReason.trim()) {
      setError('A reason is required to reject identity documents.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await membershipApi.reviewIdentity(
        id,
        identityConfirmation,
        identityReason.trim(),
      );
      setNotice(`Identity documents ${identityConfirmation}.`);
      setIdentityConfirmation('');
      setIdentityReason('');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) return <LoadingState />;
  if (!data && error) {
    return <section className="grid gap-4">
      <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>
      <Button variant="secondary" onClick={load}>Retry</Button>
    </section>;
  }

  return <section className="grid gap-5">
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {loading && <p className="text-sm text-slate-500" role="status">Loading documents…</p>}

    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Identity documents</h2>
          <p className="mt-1 text-sm text-slate-500">Sensitive files are private and are only served to authenticated administrators.</p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
          identity?.status === 'verified' ? 'bg-emerald-100 text-emerald-800'
            : identity?.status === 'rejected' ? 'bg-rose-100 text-rose-800'
              : identity?.status === 'pending' ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-100 text-slate-700'
        }`}>{String(identity?.status || 'not submitted').replaceAll('_', ' ')}</span>
      </div>
      {identity?.status === 'not_submitted' ? (
        <p className="mt-4 text-sm text-slate-600">Identity documents have not been submitted.</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><dt className="text-sm text-slate-500">PAN</dt><dd className="font-semibold">{identity?.panMask || '—'}</dd></div>
            <div><dt className="text-sm text-slate-500">{identity?.idType?.replaceAll('_', ' ') || 'Second ID'}</dt><dd className="font-semibold">{identity?.idMask || '—'}</dd></div>
          </dl>
          {identity?.rejectionReason && <p className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">Rejection reason: {identity.rejectionReason}</p>}
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {(identity?.documents || []).map((document) => (
              <li key={document.id} className="rounded-xl border border-slate-200 p-4">
                <p className="mb-3 font-medium capitalize">{document.kind.replaceAll('_', ' ')}</p>
                <Button variant="secondary" disabled={busy} onClick={() => loadIdentityDocument(document)}>View securely</Button>
              </li>
            ))}
          </ul>
          {identity?.status === 'pending' && <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap gap-2">
              <Button disabled={busy} onClick={() => setIdentityConfirmation('verified')}>Verify identity</Button>
            </div>
            <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
              event.preventDefault();
              if (identityReason.trim()) setIdentityConfirmation('rejected');
            }}>
              <FormField label="Reason for rejecting identity documents">
                <textarea className={controlClass} rows="2" required maxLength="1000" value={identityReason} onChange={(event) => setIdentityReason(event.target.value)} />
              </FormField>
              <Button className="self-end" type="submit" variant="danger" disabled={busy || !identityReason.trim()}>Reject identity</Button>
            </form>
          </div>}
        </>
      )}
    </Panel>

    {corporate ? <Panel>
      <h2 className="mb-4 font-display text-xl">Corporate details</h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        <div><dt className="text-sm text-slate-500">Company name</dt><dd className="mt-1 font-semibold">{companyDetails.companyName || '—'}</dd></div>
        <div><dt className="text-sm text-slate-500">GST number</dt><dd className="mt-1 font-semibold">{companyDetails.gstNumber || '—'}</dd></div>
        <div><dt className="text-sm text-slate-500">Contact person</dt><dd className="mt-1 font-semibold">{companyDetails.contactPerson || '—'}</dd></div>
      </dl>
      <p className="mt-5 text-sm text-slate-600">Corporate company details are recorded for this tier; no separate proof document is required here.</p>
    </Panel> : privileged ? <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Privileged tier proof</h2>
          <p className="mt-1 text-sm text-slate-500">Uploaded verification documents are available to administrators only.</p>
        </div>
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${awaitingVerification ? 'bg-amber-100 text-amber-800' : membership?.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
          {awaitingVerification ? 'Pending verification' : membership?.status === 'active' ? 'Verified' : String(membership?.status || 'Unknown').replaceAll('_', ' ')}
        </span>
      </div>
      {documents.length
        ? <ul className="mt-5 grid gap-3">
          {documents.map((document) => {
            const loaded = loadedDocuments.find((item) => item.id === document.id);
            return <li key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4">
              <div>
                <p className="font-medium text-slate-800">{document.originalName || 'Verification proof'}</p>
                <p className="mt-1 text-xs text-slate-500">Uploaded {document.uploadedAt ? new Date(document.uploadedAt).toLocaleString('en-IN') : 'date unavailable'}</p>
              </div>
              {loaded
                ? <div className="flex gap-2">
                  <a className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={loaded.url} target="_blank" rel="noreferrer">Open</a>
                  <a className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50" href={loaded.url} download={loaded.name}>Download</a>
                </div>
                : <Button variant="secondary" disabled={busy} onClick={() => loadDocument(document)}>Load secure document</Button>}
            </li>;
          })}
        </ul>
        : <p className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">No proof document has been uploaded.</p>}
      {awaitingVerification && documents.length > 0 && <div className="mt-5 border-t border-slate-100 pt-5">
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => setConfirmation('approve')}>Approve verification</Button>
        </div>
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]" onSubmit={(event) => {
          event.preventDefault();
          if (rejectReason.trim()) setConfirmation('reject');
        }}>
          <FormField label="Reason for rejecting proof">
            <textarea className={controlClass} rows="2" required maxLength="1000" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} />
          </FormField>
          <Button className="self-end" type="submit" variant="danger" disabled={busy || !rejectReason.trim()}>Reject verification</Button>
        </form>
      </div>}
    </Panel> : <Panel>
      <h2 className="font-display text-xl">Membership documents</h2>
      <p className="mt-3 text-sm text-slate-600">No proof document is required for the {plan?.name || plan?.title || 'selected'} tier.</p>
    </Panel>}

    {confirmation && <ConfirmDialog
      title={confirmation === 'approve' ? 'Approve membership proof?' : 'Reject membership proof?'}
      onCancel={() => setConfirmation('')}
      onConfirm={decideVerification}
      confirmLabel={confirmation === 'approve' ? 'Approve proof' : 'Reject proof'}
      busy={busy}
    >
      {confirmation === 'approve'
        ? 'Confirm that the privileged-tier proof has been reviewed and approve this membership verification.'
        : `Confirm rejection of the membership proof. Reason: ${rejectReason}`}
    </ConfirmDialog>}
    {identityConfirmation && <ConfirmDialog
      title={identityConfirmation === 'verified' ? 'Verify identity documents?' : 'Reject identity documents?'}
      onCancel={() => setIdentityConfirmation('')}
      onConfirm={decideIdentityVerification}
      confirmLabel={identityConfirmation === 'verified' ? 'Verify documents' : 'Reject documents'}
      busy={busy}
    >
      {identityConfirmation === 'verified'
        ? 'Confirm that the submitted PAN and second ID are valid.'
        : `Confirm rejection of the identity documents. Reason: ${identityReason}`}
    </ConfirmDialog>}
    {identityPreview && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Identity document preview" onClick={() => setIdentityPreview(null)}>
      <div className="max-h-[90vh] w-full max-w-4xl rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold capitalize">{identityPreview.name}</h2>
          <div className="flex gap-2">
            <a className="inline-flex items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold" href={identityPreview.url} download={identityPreview.name}>Download</a>
            <Button variant="secondary" onClick={() => setIdentityPreview(null)}>Close</Button>
          </div>
        </div>
        {identityPreview.mimeType === 'application/pdf'
          ? <iframe title={identityPreview.name} src={identityPreview.url} className="h-[75vh] w-full rounded-lg border" />
          : <img src={identityPreview.url} alt={identityPreview.name} className="mx-auto max-h-[75vh] max-w-full object-contain" />}
      </div>
    </div>}
  </section>;
}
