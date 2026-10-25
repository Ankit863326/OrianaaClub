// This page edits membership plan prices, availability, and the JSON points-tier data.
import { useEffect, useState } from 'react';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { Button, DataTable, FormField, LoadingState, PageHeading, Panel, Toast, controlClass, formatRupees } from '../components/ui.jsx';

const blankPlan = { id: '', title: '', subtitle: '', price: '', gstPercent: 18, planFee: '', isActive: true, isFeatured: false, sortOrder: 0, pointsTiers: [] };

export default function PlansPage() {
  const [plans, setPlans] = useState(null);
  const [selected, setSelected] = useState(null);
  const [tiers, setTiers] = useState('[]');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function load() {
    setPlans(null);
    setError('');
    try { setPlans((await adminApi.plans({ limit: 100 })).items); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  useEffect(() => { load(); }, []);
  function choose(plan) {
    const value = plan ? { ...plan } : { ...blankPlan };
    setSelected(value);
    setTiers(JSON.stringify(value.pointsTiers || [], null, 2));
  }
  async function save(event) {
    event.preventDefault();
    setError('');
    try {
      const values = { ...selected, price: Number(selected.price), gstPercent: Number(selected.gstPercent), planFee: Number(selected.planFee), sortOrder: Number(selected.sortOrder), pointsTiers: JSON.parse(tiers) };
      if (selected._id) await adminApi.updatePlan(selected._id, values);
      else await adminApi.createPlan(values);
      setSelected(null);
      setNotice('Plan saved.');
      await load();
    } catch (failure) { setError(failure instanceof SyntaxError ? 'Points tiers must be valid JSON.' : errorMessage(failure)); }
  }
  const columns = [
    { key: 'title', label: 'Plan' },
    { key: 'price', label: 'Price', render: (row) => formatRupees(row.price) },
    { key: 'planFee', label: 'Plan fee', render: (row) => formatRupees(row.planFee) },
    { key: 'isActive', label: 'Status', render: (row) => row.isActive ? 'Active' : 'Inactive' },
    { key: 'edit', label: '', render: (row) => <Button variant="secondary" onClick={() => choose(row)}>Edit</Button> },
  ];
  return <section>
    <PageHeading eyebrow="CATALOGUE" title="Plans" actions={<Button onClick={() => choose(null)}>Add plan</Button>} />
    {error && <Toast kind="error">{error}</Toast>}{notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {selected && <Panel className="mb-5">
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={save}>
        <h2 className="font-display text-xl sm:col-span-2">{selected._id ? 'Edit plan' : 'Create plan'}</h2>
        {[
          ['Plan slug', 'id', 'text'], ['Title', 'title', 'text'], ['Subtitle', 'subtitle', 'text'], ['Price (INR)', 'price', 'number'], ['GST %', 'gstPercent', 'number'], ['Plan fee (INR)', 'planFee', 'number'], ['Sort order', 'sortOrder', 'number'],
        ].map(([label, key, type]) => <FormField label={label} key={key}><input className={controlClass} type={type} min={type === 'number' ? 0 : undefined} disabled={key === 'id' && Boolean(selected._id)} required={['id', 'title', 'price', 'gstPercent', 'planFee'].includes(key)} value={selected[key] ?? selected.slug ?? ''} onChange={(event) => setSelected({ ...selected, [key]: event.target.value, ...(key === 'id' ? { slug: event.target.value } : {}) })} /></FormField>)}
        <FormField label="Points tiers (JSON)" className="sm:col-span-2"><textarea className={`${controlClass} font-mono`} rows="7" value={tiers} onChange={(event) => setTiers(event.target.value)} /></FormField>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(selected.isActive)} onChange={(event) => setSelected({ ...selected, isActive: event.target.checked })} />Active</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(selected.isFeatured)} onChange={(event) => setSelected({ ...selected, isFeatured: event.target.checked })} />Featured</label>
        <div className="flex gap-2 sm:col-span-2"><Button type="submit">Save plan</Button><Button type="button" variant="secondary" onClick={() => setSelected(null)}>Cancel</Button></div>
      </form>
    </Panel>}
    {!plans && !error && <LoadingState />}
    {plans && <DataTable columns={columns} rows={plans} empty="No plans have been configured." />}
  </section>;
}
