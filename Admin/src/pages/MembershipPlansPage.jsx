import { useEffect, useState } from 'react';
import { errorMessage } from '../api/client.js';
import { membershipApi } from '../api/membership.js';
import { Badge, Button, DataTable, FormField, LoadingState, PageHeading, Pagination, Panel, Toast, controlClass, formatPoints, formatRupees } from '../components/ui.jsx';

const editableFields = [
  ['Name', 'name', 'text'],
  ['Price', 'price', 'number'],
  ['Early-bird points', 'earlyBirdPoints', 'number'],
  ['Default points', 'defaultPoints', 'number'],
  ['Renewal points', 'renewalPoints', 'number'],
  ['Sort order', 'sortOrder', 'number'],
];

export default function MembershipPlansPage() {
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setError('');
    try { setData(await membershipApi.plans()); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  useEffect(() => { load(); }, []);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = Object.fromEntries(editableFields.slice(1).map(([, key]) => [key, Number(selected[key])]));
      body.name = selected.name;
      body.isActive = Boolean(selected.isActive);
      await membershipApi.updatePlan(selected._id, body);
      setSelected(null);
      setNotice('Membership plan saved.');
      await load();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }

  const columns = [
    { key: 'sortOrder', label: '#' },
    { key: 'name', label: 'Tier' },
    { key: 'price', label: 'Price', render: (row) => formatRupees(row.price) },
    { key: 'earlyBirdPoints', label: 'Early bird', render: (row) => `${formatPoints(row.earlyBirdPoints)} pts` },
    { key: 'defaultPoints', label: 'Default points', render: (row) => `${formatPoints(row.defaultPoints)} pts` },
    { key: 'renewalPoints', label: 'Renewal points', render: (row) => `${formatPoints(row.renewalPoints)} pts` },
    { key: 'isActive', label: 'Status', render: (row) => <Badge>{row.isActive ? 'Active' : 'Inactive'}</Badge> },
    { key: 'edit', label: '', render: (row) => <Button variant="secondary" onClick={() => setSelected({ ...row })}>Edit</Button> },
  ];

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Membership plans" description="Manage tier prices, points and availability." />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {data && <Panel className="mb-5 flex flex-wrap items-center justify-between gap-4">
      <div><p className="text-sm text-slate-500">Early-bird counter</p><strong className="font-display text-2xl">{formatPoints(data.earlyBird.used)} of {formatPoints(data.earlyBird.limit)} used</strong></div>
      <Badge>{formatPoints(data.earlyBird.remaining)} slots remaining</Badge>
    </Panel>}
    {!data && !error && <LoadingState />}
    {data && <DataTable columns={columns} rows={data.items} empty="No membership tiers configured." />}
    {selected && <Panel className="mt-5">
      <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-display text-xl sm:col-span-2">Edit {selected.name}</h2>
        {editableFields.map(([label, key, type]) => <FormField key={key} label={label}>
          <input className={controlClass} type={type} min={type === 'number' ? 0 : undefined} step="1" required value={selected[key] ?? ''} onChange={(event) => setSelected({ ...selected, [key]: event.target.value })} />
        </FormField>)}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(selected.isActive)} onChange={(event) => setSelected({ ...selected, isActive: event.target.checked })} />Active plan</label>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save plan'}</Button><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancel</Button></div>
      </form>
    </Panel>}
  </section>;
}
