import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Button,
  ConfirmDialog,
  DataTable,
  FormField,
  LoadingState,
  PageHeading,
  Panel,
  Toast,
  controlClass,
} from '../components/ui.jsx';
import { errorMessage } from '../api/client.js';
import { formatMembershipDate } from './formatters.js';
import { membershipSettingsApi } from './settingsApi.js';

const settingFields = [
  ['Discount percent', 'discountPercent', 0, 100],
  ['Points validity (years)', 'pointsValidityYears', 1],
  ['Membership validity (years)', 'membershipValidityYears', 1],
  ['Maximum family members', 'maxFamilyMembers', 1],
  ['Child age limit', 'childAgeLimit', 0],
  ['Early-bird limit', 'earlyBirdLimit', 0],
];

const keyColumns = [
  { key: 'name', label: 'Name' },
  { key: 'isActive', label: 'Status', render: (key) => key.isActive ? 'Active' : 'Inactive' },
  { key: 'lastUsedAt', label: 'Last used', render: (key) => formatMembershipDate(key.lastUsedAt) },
  { key: 'createdAt', label: 'Created', render: (key) => formatMembershipDate(key.createdAt) },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [keys, setKeys] = useState(null);
  const [keyName, setKeyName] = useState('');
  const [rawKey, setRawKey] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [targetKey, setTargetKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [keysError, setKeysError] = useState('');
  const [keyCreateError, setKeyCreateError] = useState('');
  const [notice, setNotice] = useState('');
  const dialogRef = useRef(null);
  const copyButtonRef = useRef(null);

  useEffect(() => {
    if (!rawKey) return undefined;

    const previousFocus = document.activeElement;
    copyButtonRef.current?.focus();

    function keepFocusInDialog(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusableElements = dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled])',
      );
      if (!focusableElements?.length) {
        event.preventDefault();
        return;
      }

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', keepFocusInDialog);
    return () => {
      document.removeEventListener('keydown', keepFocusInDialog);
      previousFocus?.focus?.();
    };
  }, [rawKey]);

  async function loadSettings() {
    setSettingsError('');
    try {
      setSettings(await membershipSettingsApi.getSettings());
    } catch (failure) {
      setSettingsError(errorMessage(failure));
    }
  }

  async function loadKeys() {
    setKeysError('');
    try {
      setKeys(await membershipSettingsApi.apiKeys());
    } catch (failure) {
      setKeysError(errorMessage(failure));
    }
  }

  useEffect(() => {
    loadSettings();
    loadKeys();
  }, []);

  function changeSetting(key, value) {
    setSettings({ ...settings, [key]: value });
  }

  function validateSettings() {
    for (const [label, key, minimum, maximum] of settingFields) {
      const value = Number(settings[key]);
      if (!Number.isInteger(value) || value < minimum || (maximum !== undefined && value > maximum)) {
        setSettingsError(`${label} must be a whole number from ${minimum}${maximum === undefined ? ' upward' : ` to ${maximum}`}.`);
        return false;
      }
    }
    setSettingsError('');
    return true;
  }

  async function saveSettings() {
    setBusy(true);
    setSettingsError('');
    try {
      const values = Object.fromEntries(settingFields.map(([, key]) => [key, Number(settings[key])]));
      values.receiptCompanyName = settings.receiptCompanyName || '';
      values.receiptAddress = settings.receiptAddress || '';
      values.receiptGstin = settings.receiptGstin || '';
      values.receiptFooterNote = settings.receiptFooterNote || '';
      setSettings(await membershipSettingsApi.updateSettings(values));
      setConfirmation('');
      setNotice('Membership settings saved.');
    } catch (failure) {
      setSettingsError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function saveGstSettings(event) {
    event.preventDefault();
    const rate = Number(settings.gstRate);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100
      || Math.abs(rate * 100 - Math.round(rate * 100)) >= 1e-8) {
      setSettingsError('GST rate must be from 0 to 100 with at most two decimal places.');
      return;
    }
    if (!String(settings.gstLabel || '').trim()) {
      setSettingsError('GST label is required.');
      return;
    }

    setBusy(true);
    setSettingsError('');
    try {
      const values = {
        gstEnabled: Boolean(settings.gstEnabled),
        gstRate: rate,
        gstLabel: String(settings.gstLabel).trim(),
        gstin: String(settings.gstin || '').trim(),
      };
      setSettings(await membershipSettingsApi.updateSettings(values));
      setNotice('GST settings saved.');
    } catch (failure) {
      setSettingsError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function createKey(event) {
    event.preventDefault();
    const name = keyName.trim();
    if (!name) return;
    setKeyBusy(true);
    setKeysError('');
    setKeyCreateError('');
    try {
      const created = await membershipSettingsApi.createApiKey(name);
      setRawKey(created.key);
      setCopied(false);
      setKeyName('');
      setNotice('API key created. Copy it now; it will not be shown again.');
      await loadKeys();
    } catch (failure) {
      setKeyCreateError(errorMessage(failure));
    } finally {
      setKeyBusy(false);
    }
  }

  async function revokeKey() {
    setBusy(true);
    setKeysError('');
    try {
      await membershipSettingsApi.revokeApiKey(targetKey._id);
      setTargetKey(null);
      setNotice('API key revoked.');
      await loadKeys();
    } catch (failure) {
      setKeysError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  async function copyKey() {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
    } catch (failure) {
      setKeysError(`Could not copy the key: ${failure.message || 'clipboard access is unavailable.'}`);
    }
  }

  const columns = [
    ...keyColumns,
    { key: 'revoke', label: '', render: (row) => row.isActive ? <Button variant="danger" onClick={() => setTargetKey(row)}>Revoke</Button> : null },
  ];

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Settings" description="Configure membership validity, discounts, and billing API access." />
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {settingsError && <Toast kind="error" onDismiss={() => setSettingsError('')}>{settingsError}</Toast>}
    {settings === null && !settingsError && <LoadingState />}
    {settingsError && settings === null && <Button variant="secondary" onClick={loadSettings}>Retry settings</Button>}
    {settings && <Panel className="mb-6">
      <form onSubmit={(event) => {
        event.preventDefault();
        if (validateSettings()) setConfirmation('settings');
      }}>
        <h2 className="mb-4 font-display text-xl">Membership settings</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {settingFields.map(([label, key, minimum, maximum]) => <FormField key={key} label={label}>
            <input
              className={controlClass}
              type="number"
              min={minimum}
              max={maximum}
              step="1"
              required
              value={settings[key] ?? ''}
              onChange={(event) => changeSetting(key, event.target.value)}
            />
          </FormField>)}
        </div>
        <div className="mt-6 border-t border-slate-200 pt-5">
          <h3 className="mb-3 font-semibold text-slate-800">Receipt details</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Company name">
              <input className={controlClass} maxLength="160" value={settings.receiptCompanyName || ''} onChange={(event) => changeSetting('receiptCompanyName', event.target.value)} />
            </FormField>
            <FormField label="GSTIN">
              <input className={controlClass} maxLength="30" value={settings.receiptGstin || ''} onChange={(event) => changeSetting('receiptGstin', event.target.value)} />
            </FormField>
            <FormField label="Address">
              <textarea className={controlClass} rows="2" maxLength="500" value={settings.receiptAddress || ''} onChange={(event) => changeSetting('receiptAddress', event.target.value)} />
            </FormField>
            <FormField label="Footer note">
              <textarea className={controlClass} rows="2" maxLength="500" value={settings.receiptFooterNote || ''} onChange={(event) => changeSetting('receiptFooterNote', event.target.value)} />
            </FormField>
          </div>
        </div>
        <Button className="mt-5" type="submit">Save settings</Button>
      </form>
    </Panel>}
    {settings && <Panel className="mb-6">
      <form onSubmit={saveGstSettings}>
        <h2 className="mb-4 font-display text-xl">GST / Tax</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FormField label="GST enabled">
            <label className="flex min-h-11 items-center gap-3">
              <input
                type="checkbox"
                checked={Boolean(settings.gstEnabled)}
                onChange={(event) => changeSetting('gstEnabled', event.target.checked)}
              />
              <span>{settings.gstEnabled ? 'Enabled' : 'Disabled'}</span>
            </label>
          </FormField>
          <FormField label="GST rate (%)">
            <input
              className={controlClass}
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              value={settings.gstRate ?? 18}
              onChange={(event) => changeSetting('gstRate', event.target.value)}
            />
          </FormField>
          <FormField label="Label">
            <input
              className={controlClass}
              maxLength="40"
              required
              value={settings.gstLabel || 'GST'}
              onChange={(event) => changeSetting('gstLabel', event.target.value)}
            />
          </FormField>
          <FormField label="GSTIN (optional)">
            <input
              className={controlClass}
              maxLength="30"
              value={settings.gstin || ''}
              onChange={(event) => changeSetting('gstin', event.target.value)}
            />
          </FormField>
        </div>
        <Button className="mt-5" type="submit" disabled={busy}>Save GST settings</Button>
      </form>
    </Panel>}
    {keysError && <Toast kind="error" onDismiss={() => setKeysError('')}>{keysError}</Toast>}
    <Panel>
      <h2 className="mb-4 font-display text-xl">Billing API keys</h2>
      <form className="mb-5 flex flex-wrap items-end gap-3" onSubmit={createKey}>
        <FormField label="Key name" className="min-w-60 flex-1">
          <>
            <input
              className={controlClass}
              maxLength="120"
              required
              value={keyName}
              aria-invalid={Boolean(keyCreateError)}
              aria-describedby={keyCreateError ? 'api-key-create-error' : undefined}
              onChange={(event) => {
                setKeyName(event.target.value);
                if (keyCreateError) setKeyCreateError('');
              }}
            />
            {keyCreateError && <span id="api-key-create-error" className="text-sm text-red-700" role="alert">{keyCreateError}</span>}
          </>
        </FormField>
        <Button type="submit" disabled={keyBusy || !keyName.trim()}>Create API key</Button>
      </form>
      {keys === null && !keysError && <LoadingState />}
      {keysError && keys === null && <Button variant="secondary" onClick={loadKeys}>Retry API keys</Button>}
      {keys && <DataTable columns={columns} rows={keys} empty="No billing API keys have been created." />}
    </Panel>
    {confirmation === 'settings' && <ConfirmDialog
      title="Save membership settings?"
      onCancel={() => setConfirmation('')}
      onConfirm={saveSettings}
      confirmLabel="Save settings"
      busy={busy}
    >
      Confirm these membership settings changes.
    </ConfirmDialog>}
    {targetKey && <ConfirmDialog
      title="Revoke billing API key?"
      onCancel={() => setTargetKey(null)}
      onConfirm={revokeKey}
      confirmLabel="Revoke key"
      busy={busy}
    >
      {`Revoke "${targetKey.name}"? Integrations using this key will no longer be able to authenticate.`}
    </ConfirmDialog>}
    {rawKey && createPortal(<div className="fixed inset-0 z-[1000] grid place-items-center overflow-y-auto bg-midnight/55 p-4" role="presentation">
      <section ref={dialogRef} className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="new-key-title">
        <h2 id="new-key-title" className="font-display text-2xl text-slate-900">Billing API key created</h2>
        <p className="my-4 text-sm text-amber-800">You will not see this key again.</p>
        <input className={`${controlClass} break-all font-mono`} aria-label="New billing API key" value={rawKey} readOnly />
        {copied && <p className="mt-2 text-sm text-emerald-700" role="status">Key copied.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={copyButtonRef} variant="secondary" onClick={copyKey}>{copied ? 'Copied' : 'Copy'}</Button>
          <Button onClick={() => { setRawKey(''); setCopied(false); }}>I have copied the key</Button>
        </div>
      </section>
    </div>, document.body)}
  </section>;
}
