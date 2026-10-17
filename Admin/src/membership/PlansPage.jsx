import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client.js';
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
import { membershipAdminApi } from './api.js';
import { formatINR, formatPts } from './formatters.js';
import StatusChip from './StatusChip.jsx';

const fields = [
  ['Name', 'name', 'text'],
  ['Price', 'price', 'number'],
  ['Early-bird points', 'earlyBirdPoints', 'number'],
  ['Default points', 'defaultPoints', 'number'],
  ['Renewal points', 'renewalPoints', 'number'],
];

export default function PlansPage() {
  const [plans, setPlans] = useState(null);
  const [counter, setCounter] = useState(null);
  const [selected, setSelected] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try {
      const [planData, earlyBirdData] = await Promise.all([
        membershipAdminApi.plans(),
        membershipAdminApi.earlyBirdCounter(),
      ]);
      setPlans(planData.items || []);
      setCounter(earlyBirdData);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setBusy(true);
    setError('');
    try {
      const values = {
        name: selected.name,
        price: Number(selected.price),
        earlyBirdPoints: Number(selected.earlyBirdPoints),
        defaultPoints: Number(selected.defaultPoints),
        renewalPoints: Number(selected.renewalPoints),
        isActive: Boolean(selected.isActive),
      };
      await membershipAdminApi.updatePlan(selected._id, values);
      setSelected(null);
      setConfirming(false);
      setNotice('Membership plan saved.');
      await load();
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setBusy(false);
    }
  }

  const columns = [
    { key: 'name', label: 'Tier' },
    { key: 'price', label: 'Price', render: (row) => formatINR(row.price) },
    { key: 'earlyBirdPoints', label: 'Early-bird points', render: (row) => formatPts(row.earlyBirdPoints) },
    { key: 'defaultPoints', label: 'Default points', render: (row) => formatPts(row.defaultPoints) },
    { key: 'renewalPoints', label: 'Renewal points', render: (row) => formatPts(row.renewalPoints) },
    { key: 'isActive', label: 'Status', render: (row) => <StatusChip active={row.isActive} /> },
    { key: 'edit', label: '', render: (row) => <Button variant="secondary" onClick={() => setSelected({ ...row })}>Edit</Button> },
  ];

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Plans" description="Manage the eight membership tiers and their points." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {!plans && !error && <LoadingState />}
    {error && !plans && <Button variant="secondary" onClick={load}>Retry</Button>}
    {plans && <>
      {counter && <Panel className="mb-5">
        <p className="text-sm text-slate-500">Early-bird counter</p>
        <strong className="font-display text-2xl">
          {Number(counter.used || 0).toLocaleString('en-IN')} of {Number(counter.limit || 0).toLocaleString('en-IN')} used
        </strong>
      </Panel>}
      <DataTable columns={columns} rows={plans} empty="No membership tiers configured." />
    </>}
    {selected && <Panel className="mt-5">
      <form onSubmit={(event) => { event.preventDefault(); setConfirming(true); }} className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-xl sm:col-span-2">Edit {selected.name}</h2>
        {fields.map(([label, key, type]) => <FormField key={key} label={label}>
          <input
            className={controlClass}
            type={type}
            min={type === 'number' ? 0 : undefined}
            step="1"
            required
            value={selected[key] ?? ''}
            onChange={(event) => setSelected({ ...selected, [key]: event.target.value })}
          />
        </FormField>)}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={Boolean(selected.isActive)} onChange={(event) => setSelected({ ...selected, isActive: event.target.checked })} />
          Active plan
        </label>
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit">Save plan</Button>
          <Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
        </div>
      </form>
    </Panel>}
    {confirming && <ConfirmDialog
      title="Save membership plan?"
      onCancel={() => setConfirming(false)}
      onConfirm={save}
      confirmLabel="Save plan"
      busy={busy}
    >
      Confirm the changes to {selected.name}.
    </ConfirmDialog>}
  </section>;
}
