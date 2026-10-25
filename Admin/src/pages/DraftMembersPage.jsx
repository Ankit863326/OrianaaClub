import { useEffect, useState } from 'react';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  FormField,
  LoadingState,
  PageHeading,
  Pagination,
  Panel,
  Toast,
  controlClass,
} from '../components/ui.jsx';

const initialFilters = { page: 1, limit: 25, status: '', needsHelp: '', search: '' };
const statuses = ['draft', 'payment_pending', 'paid', 'password_pending', 'active', 'failed'];

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('en-IN') : '—';
}

export default function DraftMembersPage() {
  const [filters, setFilters] = useState(initialFilters);
  const [data, setData] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const [form, setForm] = useState({ transactionId: '', note: '', email: '', phone: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setData(null);
    setError('');
    try {
      setData(await adminApi.drafts(filters));
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  useEffect(() => {
    let active = true;
    adminApi.drafts(filters).then((result) => {
      if (active) setData(result);
    }).catch((failure) => {
      if (active) setError(errorMessage(failure));
    });
    return () => { active = false; };
  }, [filters]);

  function requestAction(action, row) {
    setError('');
    setForm({
      transactionId: row.transactionId || '',
      note: row.adminNotes || '',
      email: row.email,
      phone: row.phone,
    });
    setConfirmation({ action, row });
  }

  async function confirmAction(event) {
    event?.preventDefault();
    if (!confirmation) return;
    const { action, row } = confirmation;
    setBusy(true);
    setError('');
    try {
      if (action === 'resend-link') {
        await adminApi.resendDraftLink(row._id);
        setNotice(`Password setup link requested for ${row.email}.`);
      } else if (action === 'mark-paid') {
        await adminApi.markDraftPaid(row._id, {
          transactionId: form.transactionId,
          note: form.note,
        });
        setNotice('Membership payment marked paid.');
      } else if (action === 'set-temp-password') {
        const result = await adminApi.setDraftTemporaryPassword(row._id);
        setNotice(`Temporary password for ${row.email}: ${result.temporaryPassword}`);
      } else if (action === 'edit') {
        await adminApi.updateDraft(row._id, {
          email: form.email,
          ...(form.phone ? { phone: form.phone } : {}),
        });
        setNotice('Draft member details updated.');
      } else if (action === 'activate') {
        await adminApi.activateDraftMember(row._id);
        setNotice('Member activated.');
      } else if (action === 'delete') {
        await adminApi.deleteDraft(row._id);
        setNotice('Draft member deleted.');
      }
      setConfirmation(null);
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'email', label: 'Email' },
    { key: 'plan', label: 'Plan' },
    { key: 'currentStep', label: 'Step', render: (row) => `${row.currentStep} of 6` },
    {
      key: 'paymentStatus',
      label: 'Payment status',
      render: (row) => <Badge>{row.paymentStatus.replaceAll('_', ' ')}</Badge>,
    },
    {
      key: 'needsHelp',
      label: 'Help',
      render: (row) => row.needsHelp ? <Badge tone="pending">Needs help</Badge> : '—',
    },
    { key: 'updatedAt', label: 'Last updated', render: (row) => formatDateTime(row.updatedAt) },
    {
      key: 'actions',
      label: 'Actions',
      render: (row) => {
        const paymentConfirmed = ['paid', 'confirmed'].includes(row.paymentStatus);
        return <div className="flex min-w-72 flex-wrap gap-1.5">
        <Button variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={() => requestAction('edit', row)}>Edit</Button>
        <Button variant="secondary" className="px-2.5 py-1.5 text-xs" disabled={!row.memberId || row.passwordSet || row.status === 'active'} onClick={() => requestAction('resend-link', row)}>Resend link</Button>
        <Button variant="secondary" className="px-2.5 py-1.5 text-xs" disabled={!row.memberId || paymentConfirmed} onClick={() => requestAction('mark-paid', row)}>Mark paid</Button>
        <Button variant="secondary" className="px-2.5 py-1.5 text-xs" disabled={!paymentConfirmed} onClick={() => requestAction('set-temp-password', row)}>Temp password</Button>
        <Button variant="secondary" className="px-2.5 py-1.5 text-xs" disabled={row.status !== 'password_pending' || !paymentConfirmed} onClick={() => requestAction('activate', row)}>Activate</Button>
        <Button variant="danger" className="px-2.5 py-1.5 text-xs" onClick={() => requestAction('delete', row)}>Delete</Button>
        </div>;
      },
    },
  ];

  const actionTitle = {
    'resend-link': 'Resend password setup link?',
    'mark-paid': 'Mark membership payment as paid?',
    'set-temp-password': 'Set a temporary password?',
    edit: 'Update draft member details?',
    activate: 'Activate member account?',
    delete: 'Delete this draft application?',
  };

  return <section>
    <PageHeading
      eyebrow="MEMBERSHIP"
      title="Draft Members"
      description="Review incomplete applications and resolve payment or account setup issues."
    />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    <Panel className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <FormField label="Search name, email, or phone">
        <input className={controlClass} value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} />
      </FormField>
      <FormField label="Application status">
        <select className={controlClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value, page: 1 })}>
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
        </select>
      </FormField>
      <FormField label="Help requests">
        <select className={controlClass} value={filters.needsHelp} onChange={(event) => setFilters({ ...filters, needsHelp: event.target.value, page: 1 })}>
          <option value="">All applications</option>
          <option value="true">Needs help</option>
          <option value="false">No help requested</option>
        </select>
      </FormField>
    </Panel>
    {!data && !error && <LoadingState />}
    {data && <>
      {data.items.length > 0 && data.items.some((item) => item.lastEmailError) && (
        <Panel className="mb-4">
          <h2 className="mb-2 font-semibold text-slate-900">Recent email delivery errors</h2>
          <ul className="space-y-1 text-sm text-red-700">
            {data.items.filter((item) => item.lastEmailError).map((item) => (
              <li key={item._id}>{item.email}: {item.lastEmailError}</li>
            ))}
          </ul>
        </Panel>
      )}
      <DataTable columns={columns} rows={data.items} empty="No draft members match these filters." />
      <Pagination info={data} onPage={(page) => setFilters({ ...filters, page })} />
    </>}
    {confirmation && <ConfirmDialog
      title={actionTitle[confirmation.action]}
      confirmLabel={confirmation.action === 'delete' ? 'Delete' : 'Confirm'}
      onCancel={() => setConfirmation(null)}
      onConfirm={confirmAction}
      busy={busy}
    >
      {confirmation.action === 'mark-paid' ? <form className="grid gap-3" onSubmit={confirmAction}>
        <FormField label="Transaction ID">
          <input className={controlClass} required maxLength={200} value={form.transactionId} onChange={(event) => setForm({ ...form, transactionId: event.target.value })} />
        </FormField>
        <FormField label="Admin note">
          <textarea className={controlClass} maxLength={1000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
        </FormField>
      </form> : confirmation.action === 'edit' ? <form className="grid gap-3" onSubmit={confirmAction}>
        <FormField label="Email">
          <input className={controlClass} type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </FormField>
        <FormField label="Phone">
          <input className={controlClass} type="tel" minLength={6} maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
        </FormField>
      </form> : <p>
        {confirmation.action === 'delete'
          ? `This permanently removes the application for ${confirmation.row.email}.`
          : `Confirm this action for ${confirmation.row.name} (${confirmation.row.email}).`}
      </p>}
    </ConfirmDialog>}
  </section>;
}
