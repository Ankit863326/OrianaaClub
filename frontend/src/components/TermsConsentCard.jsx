import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { apiResourceUrl } from '../config/api.js';
import { getCurrentTermsManifest } from '../lib/termsApi.js';
import './TermsConsentCard.css';

const AgreementReaderModal = lazy(() => import('./AgreementReaderModal.jsx'));

function acceptedDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default function TermsConsentCard({
  savedLanguage,
  existingConsent,
  highlighted = false,
  error = '',
  onStateChange,
}) {
  const [manifest, setManifest] = useState(null);
  const [manifestError, setManifestError] = useState('');
  const [language, setLanguage] = useState('');
  const [readLanguages, setReadLanguages] = useState({});
  const [checked, setChecked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [manifestRetry, setManifestRetry] = useState(0);
  const onStateChangeRef = useRef(onStateChange);

  const currentConsent = manifest && existingConsent?.version === manifest.version
    ? existingConsent
    : null;
  const selectedLanguage = manifest?.languages.find((item) => item.code === language);
  const readToEnd = Boolean(readLanguages[language] || currentConsent?.language === language);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
  }, [onStateChange]);

  const emitState = useCallback((nextLanguage, nextChecked, nextRead) => {
    onStateChangeRef.current?.({
      manifest,
      version: manifest?.version || '',
      language: nextLanguage,
      readToEnd: Boolean(nextRead),
      checked: Boolean(nextChecked),
      acceptedConsent: currentConsent,
    });
  }, [currentConsent, manifest]);

  useEffect(() => {
    let active = true;
    getCurrentTermsManifest()
      .then((data) => {
        if (!active) return;
        setManifest(data);
        const knownLanguage = String(savedLanguage || '').toLowerCase();
        const accepted = existingConsent?.version === data.version ? existingConsent : null;
        const nextLanguage = data.languages.find((item) => item.code === accepted?.language)?.code
          || data.languages.find((item) => item.code === knownLanguage)?.code
          || data.languages.find((item) => item.code === 'hi')?.code
          || data.languages[0]?.code
          || '';
        setLanguage(nextLanguage);
        setChecked(Boolean(accepted));
        onStateChangeRef.current?.({
          manifest: data,
          version: data.version,
          language: nextLanguage,
          readToEnd: Boolean(accepted),
          checked: Boolean(accepted),
          acceptedConsent: accepted,
        });
      })
      .catch((requestError) => {
        console.error('Agreement manifest failed to load.', requestError);
        if (active) setManifestError('Could not load the agreement. Retry.');
      });
    return () => { active = false; };
  }, [existingConsent, manifestRetry, savedLanguage]);

  useEffect(() => {
    if (!highlighted) return;
    document.getElementById('membership-terms-consent')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [highlighted]);

  function chooseLanguage(code) {
    setLanguage(code);
    setChecked(false);
    emitState(code, false, Boolean(readLanguages[code]));
  }

  function markRead(code) {
    setReadLanguages((current) => ({ ...current, [code]: true }));
    setLanguage(code);
    setChecked(false);
    emitState(code, false, true);
    setModalOpen(false);
  }

  function updateChecked(value) {
    setChecked(value);
    emitState(language, value, readToEnd);
  }

  function retryManifest() {
    setManifestError('');
    setManifest(null);
    setLanguage('');
    setManifestRetry((count) => count + 1);
  }

  return (
    <section
      id="membership-terms-consent"
      className={`terms-consent-card${highlighted ? ' terms-consent-card--highlighted' : ''}`}
      aria-labelledby="terms-consent-heading"
    >
      <div className="terms-consent-card__heading">
        <h2 id="terms-consent-heading">Terms &amp; Conditions</h2>
        <span className="terms-consent-card__required">Required</span>
      </div>
      <p className="terms-consent-card__intro">
        Please read the Orianaa Leisure Membership Agreement before you pay.
      </p>

      {manifestError ? (
        <div className="terms-consent-card__error" role="alert">
          <p>{manifestError}</p>
          <button
            type="button"
            className="terms-consent-card__text-button"
            onClick={retryManifest}
          >Retry</button>
        </div>
      ) : !manifest ? (
        <div className="terms-consent-card__skeleton" aria-label="Loading agreement details" role="status">
          <span /><span /><span /><span />
        </div>
      ) : manifest.languages.length === 0 ? (
        <>
          <ul className="terms-consent-card__points">
            {manifest.keyPoints.map((point) => (
              <li key={point}>
                <span aria-hidden="true">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="terms-consent-card__error" role="alert">
            <p>The agreement is not available yet. Please contact support.</p>
            <button
              type="button"
              className="terms-consent-card__text-button"
              onClick={retryManifest}
            >Retry</button>
          </div>
        </>
      ) : (
        <>
          <ul className="terms-consent-card__points">
            {manifest.keyPoints.map((point) => (
              <li key={point}>
                <span aria-hidden="true">✓</span>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <div className="terms-consent-card__languages" aria-label="Agreement language">
            {manifest.languages.map((item) => (
              <button
                key={item.code}
                className={`terms-consent-card__language${language === item.code ? ' is-selected' : ''}`}
                type="button"
                aria-pressed={language === item.code}
                disabled={Boolean(currentConsent)}
                onClick={() => chooseLanguage(item.code)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="terms-consent-card__actions">
            <button
              className="terms-consent-card__read"
              type="button"
              disabled={!language}
              onClick={() => setModalOpen(true)}
            >
              Read full agreement
            </button>
            {selectedLanguage?.pdfUrl && (
              <a
                className="terms-consent-card__download"
                href={apiResourceUrl(selectedLanguage.pdfUrl)}
                target="_blank"
                rel="noreferrer"
                download
              >
                Download PDF
              </a>
            )}
          </div>
          <p className={`terms-consent-card__status${readToEnd ? ' is-read' : ''}`} role="status">
            {currentConsent
              ? `Accepted on ${acceptedDate(currentConsent.acceptedAt)}`
              : readToEnd
                ? `✓ You have read the ${selectedLanguage?.label || language} agreement to the end.`
                : 'Not read yet. Open the full agreement and scroll to the end to enable the box below.'}
          </p>
          <label className="terms-consent-card__checkbox">
            <input
              type="checkbox"
              checked={Boolean(currentConsent || checked)}
              disabled={!readToEnd || Boolean(currentConsent)}
              onChange={(event) => updateChecked(event.target.checked)}
            />
            <span>
              I have read and agree to the Orianaa Leisure Membership Agreement
              {' '}({selectedLanguage?.label || language}, version {manifest.version}).
            </span>
          </label>
          {error && <p className="terms-consent-card__error" role="alert">{error}</p>}
          {modalOpen && (
            <Suspense fallback={<div className="terms-modal-skeleton" role="status">Loading agreement reader…</div>}>
              <AgreementReaderModal
                languages={manifest.languages}
                version={manifest.version}
                initialLanguage={language}
                onClose={() => setModalOpen(false)}
                onRead={markRead}
              />
            </Suspense>
          )}
        </>
      )}
    </section>
  );
}
