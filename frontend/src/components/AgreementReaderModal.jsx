import DOMPurify from 'dompurify';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TermsConsentCard.css';

const FONT_SIZE_STORAGE_KEY = 'agreement-reader-font-size';
const DEFAULT_FONT_SIZE = 18;
const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 30;

function getStoredFontSize() {
  if (typeof window === 'undefined') return DEFAULT_FONT_SIZE;
  try {
    const storedSize = Number(window.localStorage.getItem(FONT_SIZE_STORAGE_KEY));
    if (
      storedSize >= MIN_FONT_SIZE
      && storedSize <= MAX_FONT_SIZE
      && (storedSize - MIN_FONT_SIZE) % 2 === 0
    ) return storedSize;
  } catch {
    return DEFAULT_FONT_SIZE;
  }
  return DEFAULT_FONT_SIZE;
}

function getSectionHeadings(html) {
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(html);
  return [...template.content.querySelectorAll('[id]')]
    .filter((element) => /^s(?:[1-9]|1\d|2[01])$/.test(element.id))
    .map((element) => ({ id: element.id, title: element.textContent.trim() }))
    .filter((section) => section.title);
}

export default function AgreementReaderModal({
  languages,
  version,
  initialLanguage,
  onClose,
  onRead,
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [documents, setDocuments] = useState({});
  const [loadingLanguages, setLoadingLanguages] = useState({ [initialLanguage]: true });
  const [loadErrors, setLoadErrors] = useState({});
  const [attempt, setAttempt] = useState(0);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [fontSize, setFontSize] = useState(getStoredFontSize);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const textContainerRef = useRef(null);
  const sentinelRef = useRef(null);
  const hasScrolledRef = useRef(false);
  const activeLanguage = languages.find((item) => item.code === language);
  const html = documents[language] || '';
  const missingHtml = !activeLanguage?.htmlUrl;
  const loadError = loadErrors[language] || (missingHtml ? 'Could not load the agreement.' : '');
  const loading = missingHtml ? false : Boolean(loadingLanguages[language] ?? !html);

  const safeHtml = useMemo(() => (html ? DOMPurify.sanitize(html) : ''), [html]);
  const sections = useMemo(() => getSectionHeadings(safeHtml), [safeHtml]);

  useEffect(() => {
    try {
      window.localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(fontSize));
    } catch {
      return;
    }
  }, [fontSize]);

  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    if (!activeLanguage?.htmlUrl) return () => controller.abort();

    fetch(activeLanguage.htmlUrl, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the agreement.');
        return response.text();
      })
      .then((value) => {
        setDocuments((current) => ({ ...current, [language]: value }));
        setLoadErrors((current) => ({ ...current, [language]: '' }));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setLoadErrors((current) => ({
            ...current,
            [language]: 'Could not load the agreement.',
          }));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingLanguages((current) => ({ ...current, [language]: false }));
        }
      });
    return () => controller.abort();
  }, [activeLanguage?.htmlUrl, attempt, language]);

  const checkForEnd = useCallback(() => {
    const container = textContainerRef.current;
    if (!container || !hasScrolledRef.current) return;
    if (container.scrollHeight - container.scrollTop - container.clientHeight <= 24) {
      setReachedEnd(true);
    }
  }, []);

  useEffect(() => {
    const container = textContainerRef.current;
    const sentinel = sentinelRef.current;
    if (!container || !sentinel || loading || loadError) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) checkForEnd();
    }, { root: container, rootMargin: '0px 0px 24px 0px', threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [checkForEnd, html, language, loadError, loading]);

  function onScroll() {
    if (textContainerRef.current?.scrollTop > 0) hasScrolledRef.current = true;
    checkForEnd();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialogRef.current.querySelectorAll(
      'button:not(:disabled), a[href], select:not(:disabled)',
    )];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function jumpToSection(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="terms-modal-backdrop">
      <section
        ref={dialogRef}
        className="terms-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-modal-title"
        onKeyDown={handleKeyDown}
      >
        <header className="terms-modal__header">
          <div>
            <h2 id="terms-modal-title">Orianaa Leisure Membership Agreement</h2>
            <p>Version {version} · 21 sections</p>
          </div>
          <div className="terms-modal__header-actions">
            <div className="terms-modal__font-controls" role="group" aria-label="Agreement text size">
              <button
                type="button"
                aria-label="Decrease agreement text size"
                disabled={fontSize <= MIN_FONT_SIZE}
                onClick={() => setFontSize((size) => Math.max(MIN_FONT_SIZE, size - 2))}
              >
                A−
              </button>
              <button
                type="button"
                aria-label="Reset agreement text size"
                title="Reset text size"
                onClick={() => setFontSize(DEFAULT_FONT_SIZE)}
              >
                {Math.round((fontSize / DEFAULT_FONT_SIZE) * 100)}%
              </button>
              <button
                type="button"
                aria-label="Increase agreement text size"
                disabled={fontSize >= MAX_FONT_SIZE}
                onClick={() => setFontSize((size) => Math.min(MAX_FONT_SIZE, size + 2))}
              >
                A+
              </button>
            </div>
            <button ref={closeRef} className="terms-modal__close" type="button" aria-label="Close agreement" onClick={onClose}>
              ×
            </button>
          </div>
        </header>
        <div className="terms-modal__language-tabs" role="tablist" aria-label="Agreement language">
          {languages.map((item) => (
            <button
              key={item.code}
              type="button"
              role="tab"
              aria-selected={language === item.code}
              className={language === item.code ? 'is-selected' : ''}
              onClick={() => {
                setLanguage(item.code);
                setReachedEnd(false);
                hasScrolledRef.current = false;
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="terms-modal__body">
          <nav className="terms-modal__sections" aria-label="Agreement sections" style={{ fontSize: `${fontSize}px` }}>
            <label className="terms-modal__mobile-sections">
              Go to section
              <select value="" onChange={(event) => event.target.value && jumpToSection(event.target.value)}>
                <option value="">Select a section</option>
                {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
              </select>
            </label>
            <ol>
              {sections.map((section) => (
                <li key={section.id}>
                  <button type="button" onClick={() => jumpToSection(section.id)}>{section.title}</button>
                </li>
              ))}
            </ol>
          </nav>
          <div
            ref={textContainerRef}
            className="terms-modal__text"
            lang={language}
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
            onScroll={onScroll}
            aria-label={`${activeLanguage?.label || ''} agreement`}
          >
            {loading ? (
              <div className="terms-modal__loading" role="status" aria-label="Loading agreement">
                <span /><span /><span /><span /><span />
              </div>
            ) : loadError ? (
              <div className="terms-modal__load-error" role="alert">
                <p>{loadError}</p>
                <button type="button" onClick={() => {
                  setLoadErrors((current) => ({ ...current, [language]: '' }));
                  setLoadingLanguages((current) => ({ ...current, [language]: true }));
                  setAttempt((count) => count + 1);
                }}>Retry</button>
                {activeLanguage?.pdfUrl && (
                  <a href={activeLanguage.pdfUrl} target="_blank" rel="noreferrer" download>
                    Download PDF instead
                  </a>
                )}
              </div>
            ) : (
              <>
                <article className="terms-agreement-content" dangerouslySetInnerHTML={{ __html: safeHtml }} />
                <div ref={sentinelRef} className="terms-modal__end-sentinel" aria-hidden="true" />
              </>
            )}
          </div>
        </div>
        <footer className="terms-modal__footer">
          <p role="status">
            {reachedEnd ? 'You reached the end. You can confirm now.' : 'Scroll to the end of the agreement to continue.'}
          </p>
          <div>
            <button className="terms-modal__secondary" type="button" onClick={onClose}>Close</button>
            <button
              className="terms-modal__primary"
              type="button"
              disabled={!reachedEnd}
              onClick={() => onRead(language)}
            >
              I have read this
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
