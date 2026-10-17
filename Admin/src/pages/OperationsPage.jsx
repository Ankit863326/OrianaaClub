// This page handles editorial content, enquiries, admin access, reports, and activity logs.
import { useCallback, useEffect, useState } from 'react';
import { adminApi, downloadCsv } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { getImageUrl } from '../api/image.js';
import { useAuth } from '../auth/AuthContext.jsx';
import { Badge, Button, DataTable, EmptyState, FormField, LoadingState, PageHeading, Pagination, Panel, Toast, controlClass, formatDate, formatPaise, formatPoints } from '../components/ui.jsx';

const maxImageSize = 10 * 1024 * 1024;
const pageTitles = {
  posts: ['Blog Posts', 'Create and publish stories for the OrianaaClub journal.'],
  events: ['Events', 'Manage upcoming OrianaaClub events.'],
  enquiries: ['Enquiries', 'Review public requests and record follow-up notes.'],
  admins: ['Administrators', 'Invite administrators and manage access.'],
  audit: ['Audit Log', 'Review changes made by administrators.'],
  email: ['Email Log', 'Review notification delivery outcomes.'],
  reports: ['Reports', 'Review membership, revenue, and points summaries.'],
};
const newContent = {
  posts: { title: '', slug: '', excerpt: '', content: '', category: '', status: 'draft' },
  events: { title: '', slug: '', description: '', date: '', time: '', location: '', status: 'draft', capacity: '' },
};
const buildQuery = (filters, page) => ({ ...filters, page, limit: 20 });

export default function OperationsPage({ type }) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [adminOptions, setAdminOptions] = useState([]);
  const [reportData, setReportData] = useState(null);
  const [pageInfo, setPageInfo] = useState({ page: 1, pages: 1, total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filters, setFilters] = useState({});
  const [form, setForm] = useState(newContent[type] || {});
  const [editingId, setEditingId] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState('');

  useEffect(() => () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  useEffect(() => {
    setForm(newContent[type] || {});
    setEditingId('');
    setImagePreview('');
    setSelected(null);
  }, [type]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setRows(null);
    setReportData(null);
    try {
      const query = buildQuery(filters, page);
      if (type === 'posts' || type === 'events') {
        const result = await adminApi.content(type, query);
        setRows(result.items || []);
        setPageInfo(result);
      } else if (type === 'enquiries') {
        const result = await adminApi.enquiries(query);
        setRows(result.items || []);
        setPageInfo(result);
      } else if (type === 'admins') {
        const result = await adminApi.admins(query);
        setRows(result.items || []);
        setPageInfo(result);
      } else if (type === 'audit') {
        const [result, admins] = await Promise.all([adminApi.audit(query), adminApi.admins({ limit: 100 })]);
        setRows(result.items || []);
        setPageInfo(result);
        setAdminOptions(admins.items || []);
      } else if (type === 'email') {
        const result = await adminApi.emails(query);
        setRows(result.items || []);
        setPageInfo(result);
      } else {
        setReportData(await adminApi.reports(filters));
      }
    } catch (failure) {
      setError(errorMessage(failure, 'The requested information could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [filters, page, type]);
  useEffect(() => { load(); }, [load]);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }
  function resetForm() {
    setForm(newContent[type] || {});
    setEditingId('');
    setImagePreview('');
  }
  async function saveContent(event) {
    event.preventDefault();
    const file = event.currentTarget.elements.imageFile?.files?.[0];
    if (file && file.size > maxImageSize) {
      setError('Image must be 10 MB or smaller.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === 'coverImage' || key === 'image') return;
        if (value !== undefined && value !== null && value !== '') body.append(key, value);
      });
      if (file) body.append(type === 'posts' ? 'coverImage' : 'image', file);
      if (editingId) await adminApi.updateContent(type, editingId, body);
      else await adminApi.createContent(type, body);
      setNotice(`${type === 'posts' ? 'Post' : 'Event'} saved.`);
      resetForm();
      await load();
    } catch (failure) {
      setError(errorMessage(failure, 'The content could not be saved.'));
    } finally {
      setBusy(false);
    }
  }
  async function deleteContent(id) {
    if (!window.confirm('Permanently delete this content record?')) return;
    try {
      await adminApi.deleteContent(type, id);
      setNotice('Content record deleted.');
      await load();
    } catch (failure) { setError(errorMessage(failure)); }
  }
  async function inviteAdmin(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await adminApi.createAdmin(form);
      setForm({});
      setNotice(result.message || (result.activationEmailSent
        ? 'Administrator created and password setup link sent.'
        : 'Administrator created, but the password setup link could not be sent. Check email logs.'));
      await load();
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function changeAdminStatus(admin) {
    const status = admin.status === 'active' ? 'suspended' : 'active';
    if (!window.confirm(`${status === 'active' ? 'Reactivate' : 'Deactivate'} ${admin.email}?`)) return;
    try {
      await adminApi.setAdminStatus(admin._id, status);
      setNotice('Administrator status updated.');
      await load();
    } catch (failure) { setError(errorMessage(failure)); }
  }
  async function setEnquiryStatus(status) {
    if (!selected) return;
    try {
      await adminApi.setEnquiryStatus(selected._id, status);
      setSelected({ ...selected, status });
      setNotice('Enquiry status updated.');
      await load();
    } catch (failure) { setError(errorMessage(failure)); }
  }
  async function addNote(event) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    setBusy(true);
    try {
      await adminApi.addEnquiryNote(selected._id, note);
      setNote('');
      setNotice('Internal note added.');
      await load();
      const result = await adminApi.enquiries(buildQuery(filters, page));
      setSelected(result.items?.find((item) => item._id === selected._id) || null);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { setBusy(false); }
  }
  async function exportReport(report) {
    try { await downloadCsv('/admin/reports/export', { report, ...filters }); }
    catch (failure) { setError(errorMessage(failure)); }
  }
  function filterField(name, value) {
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  const [title, description] = pageTitles[type] || ['Operations', 'Manage OrianaaClub administration.'];
  return <section>
    <PageHeading eyebrow="ORIANAA CLUB" title={title} description={description} />
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}

    {(type === 'posts' || type === 'events') && <>
      <Panel className="mb-5">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={saveContent}>
          <h2 className="font-display text-xl sm:col-span-2">{editingId ? `Edit ${type === 'posts' ? 'post' : 'event'}` : `Add ${type === 'posts' ? 'post' : 'event'}`}</h2>
          <FormField label="Title"><input className={controlClass} required value={form.title || ''} onChange={(event) => setField('title', event.target.value)} /></FormField>
          <FormField label="Slug"><input className={controlClass} required value={form.slug || ''} onChange={(event) => setField('slug', event.target.value)} /></FormField>
          {type === 'posts' ? <>
            <FormField label="Category"><input className={controlClass} required value={form.category || ''} onChange={(event) => setField('category', event.target.value)} /></FormField>
            <FormField label="Excerpt"><textarea className={controlClass} required value={form.excerpt || ''} onChange={(event) => setField('excerpt', event.target.value)} /></FormField>
            <FormField label="Article content" className="sm:col-span-2"><textarea className={controlClass} rows="8" required value={form.content || ''} onChange={(event) => setField('content', event.target.value)} /></FormField>
          </> : <>
            <FormField label="Date"><input className={controlClass} required type="date" value={form.date || ''} onChange={(event) => setField('date', event.target.value)} /></FormField>
            <FormField label="Time"><input className={controlClass} value={form.time || ''} onChange={(event) => setField('time', event.target.value)} /></FormField>
            <FormField label="Location"><input className={controlClass} required value={form.location || ''} onChange={(event) => setField('location', event.target.value)} /></FormField>
            <FormField label="Capacity (optional)"><input className={controlClass} type="number" min="1" value={form.capacity || ''} onChange={(event) => setField('capacity', event.target.value)} /></FormField>
            <FormField label="Description" className="sm:col-span-2"><textarea className={controlClass} required value={form.description || ''} onChange={(event) => setField('description', event.target.value)} /></FormField>
          </>}
          <FormField label="Status"><select className={controlClass} value={form.status || 'draft'} onChange={(event) => setField('status', event.target.value)}>{type === 'posts' ? <><option value="draft">Draft</option><option value="published">Published</option></> : <><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option></>}</select></FormField>
          <FormField label="Image (JPG, JPEG, PNG, WebP; max 10 MB)"><input
            key={editingId || 'new-content'}
            className={controlClass}
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setError('');
              const file = event.target.files?.[0];
              if (!file) return;
              if (file.size > maxImageSize) {
                event.target.value = '';
                setImagePreview(getImageUrl(form.coverImage || form.image));
                setError('Image must be 10 MB or smaller.');
                return;
              }
              setImagePreview(URL.createObjectURL(file));
            }}
          /></FormField>
          {imagePreview && <div className="sm:col-span-2">
            <img
              className="h-48 max-w-full rounded-xl border border-slate-200 object-contain"
              src={imagePreview}
              alt="Image preview"
              onError={(event) => {
                event.currentTarget.hidden = true;
                event.currentTarget.nextElementSibling.hidden = false;
              }}
            />
            <p className="text-sm text-slate-500" hidden>Image preview unavailable.</p>
          </div>}
          <div className="flex gap-2 sm:col-span-2"><Button disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>{editingId && <Button type="button" variant="secondary" onClick={resetForm}>Cancel edit</Button>}</div>
        </form>
      </Panel>
      <div className="mb-4 max-w-xs"><select className={controlClass} aria-label="Filter status" value={filters.status || ''} onChange={(event) => filterField('status', event.target.value)}><option value="">All statuses</option><option value="draft">Draft</option><option value="published">Published</option>{type === 'events' && <option value="cancelled">Cancelled</option>}</select></div>
      {loading ? <LoadingState /> : error ? null : <DataTable columns={[
        { key: 'title', label: 'Title' }, { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> },
        { key: 'updatedAt', label: 'Updated', render: (item) => formatDate(item.updatedAt) },
        { key: 'actions', label: 'Actions', render: (item) => <div className="flex gap-2"><Button variant="secondary" onClick={() => {
          const edit = { ...item };
          if (type === 'events' && edit.date) edit.date = new Date(edit.date).toISOString().slice(0, 10);
        setEditingId(item._id); setForm(edit); setImagePreview(getImageUrl(edit.coverImage || edit.image));
        }}>Edit</Button><Button variant="danger" onClick={() => deleteContent(item._id)}>Delete</Button></div> },
      ]} rows={rows || []} empty={`No ${type} have been created yet.`} />}
      {!error && <Pagination info={pageInfo} onPage={setPage} />}
    </>}

    {type === 'enquiries' && <>
      <div className="mb-4 flex gap-2 overflow-x-auto">{[['All', ''], ['New', 'new'], ['Contacted', 'contacted'], ['Closed', 'closed']].map(([label, status]) => <Button key={label} variant={(filters.status || '') === status ? 'gold' : 'secondary'} onClick={() => filterField('status', status)}>{label}</Button>)}</div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <select className={controlClass} aria-label="Filter by enquiry type" value={filters.type || ''} onChange={(event) => filterField('type', event.target.value)}><option value="">All enquiry types</option><option value="experience">Experience</option><option value="contact">Contact</option><option value="query">Query</option><option value="other">Other</option></select>
        <input className={controlClass} placeholder="Search name, email, mobile" value={filters.search || ''} onChange={(event) => filterField('search', event.target.value)} />
      </div>
      {loading ? <LoadingState /> : error ? null : <DataTable columns={[
        { key: 'createdAt', label: 'Received', render: (item) => formatDate(item.createdAt) },
        { key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> },
        { key: 'open', label: '', render: (item) => <Button variant="secondary" onClick={() => setSelected(item)}>Open</Button> },
      ]} rows={rows || []} empty="No enquiries match these filters." />}
      {!error && <Pagination info={pageInfo} onPage={setPage} />}
      {selected && <Drawer onClose={() => setSelected(null)}>
        <h2 className="font-display text-2xl">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.email} · {selected.mobile || 'No mobile supplied'}</p>
        <p className="my-3 text-sm"><strong>{selected.type}</strong> · {formatDate(selected.createdAt)}</p><p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{selected.message}</p>
        <FormField label="Status" className="mt-5"><select className={controlClass} value={selected.status} onChange={(event) => setEnquiryStatus(event.target.value)}><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></FormField>
        <h3 className="mb-2 mt-6 font-semibold">Internal notes</h3>
        {(selected.internalNotes || []).map((entry) => <p className="mb-2 rounded-xl bg-slate-50 p-3 text-sm" key={entry._id}>{entry.note}<small className="mt-1 block text-slate-500">{entry.admin?.firstName || 'Admin'} · {formatDate(entry.createdAt)}</small></p>)}
        <form className="mt-4" onSubmit={addNote}><FormField label="Add internal note"><textarea className={controlClass} required value={note} onChange={(event) => setNote(event.target.value)} /></FormField><Button className="mt-3" disabled={busy}>Add note</Button></form>
      </Drawer>}
    </>}

    {type === 'admins' && <>
      <Panel className="mb-5"><form className="grid gap-4 sm:grid-cols-2" onSubmit={inviteAdmin}>
        <h2 className="font-display text-xl sm:col-span-2">Invite administrator</h2>
        <FormField label="First name"><input className={controlClass} required minLength="2" value={form.firstName || ''} onChange={(event) => setField('firstName', event.target.value)} /></FormField>
        <FormField label="Email"><input className={controlClass} required type="email" value={form.email || ''} onChange={(event) => setField('email', event.target.value)} /></FormField>
        <Button disabled={busy} className="sm:col-span-2 sm:justify-self-start">{busy ? 'Sending…' : 'Send password setup invitation'}</Button>
      </form></Panel>
      {loading ? <LoadingState /> : error ? null : <DataTable columns={[
        { key: 'firstName', label: 'Name' }, { key: 'email', label: 'Email' },
        { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> },
        { key: 'emailVerified', label: 'Email verified', render: (item) => item.emailVerified ? 'Yes' : 'No' },
        { key: 'action', label: 'Action', render: (item) => <Button variant="secondary" disabled={item.status === 'pending' || String(item._id) === String(user?.id || user?._id)} onClick={() => changeAdminStatus(item)}>{String(item._id) === String(user?.id || user?._id) ? 'Current admin' : item.status === 'active' ? 'Deactivate' : item.status === 'pending' ? 'Password not set' : 'Reactivate'}</Button> },
      ]} rows={rows || []} empty="No administrator accounts were found." />}
      {!error && <Pagination info={pageInfo} onPage={setPage} />}
    </>}

    {(type === 'audit' || type === 'email') && <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input className={controlClass} type="date" aria-label="From date" value={filters.from || ''} onChange={(event) => filterField('from', event.target.value)} />
        <input className={controlClass} type="date" aria-label="To date" value={filters.to || ''} onChange={(event) => filterField('to', event.target.value)} />
        {type === 'audit' ? <>
          <select className={controlClass} aria-label="Filter by administrator" value={filters.admin || ''} onChange={(event) => filterField('admin', event.target.value)}><option value="">All administrators</option>{adminOptions.map((item) => <option key={item._id} value={item._id}>{item.firstName} ({item.email})</option>)}</select>
          <input className={controlClass} placeholder="Action" value={filters.action || ''} onChange={(event) => filterField('action', event.target.value)} />
          <input className={controlClass} placeholder="Entity type" value={filters.entityType || ''} onChange={(event) => filterField('entityType', event.target.value)} />
        </> : <>
          <select className={controlClass} aria-label="Filter email status" value={filters.status || ''} onChange={(event) => filterField('status', event.target.value)}><option value="">All outcomes</option><option value="sent">Sent</option><option value="failed">Failed</option></select>
          <input className={controlClass} placeholder="Email recipient" value={filters.search || ''} onChange={(event) => filterField('search', event.target.value)} />
        </>}
      </div>
      {loading ? <LoadingState /> : error ? null : type === 'audit' ? <DataTable columns={[
        { key: 'createdAt', label: 'When', render: (item) => formatDate(item.createdAt) },
        { key: 'admin', label: 'Admin', render: (item) => item.admin?.email || '—' },
        { key: 'action', label: 'Action' }, { key: 'entityType', label: 'Entity' }, { key: 'summary', label: 'Summary' },
      ]} rows={rows || []} empty="No audit entries match these filters." /> : <DataTable columns={[
        { key: 'createdAt', label: 'When', render: (item) => formatDate(item.createdAt) },
        { key: 'to', label: 'Recipient' }, { key: 'template', label: 'Template' },
        { key: 'status', label: 'Status', render: (item) => <Badge>{item.status}</Badge> }, { key: 'error', label: 'Error' },
      ]} rows={rows || []} empty="No email records match these filters." />}
      {!error && <Pagination info={pageInfo} onPage={setPage} />}
    </>}

    {type === 'reports' && <>
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <input className={controlClass} type="date" aria-label="From date" value={filters.from || ''} onChange={(event) => filterField('from', event.target.value)} />
        <input className={controlClass} type="date" aria-label="To date" value={filters.to || ''} onChange={(event) => filterField('to', event.target.value)} />
      </div>
      {loading ? <LoadingState /> : error ? null : reportData ? <div className="grid gap-4 xl:grid-cols-2">
        <ReportTable title="Members by plan" columns={['Plan', 'Members']} rows={(reportData.membersByPlan || []).map((item) => [item.plan, formatPoints(item.members)])} onExport={() => exportReport('members-by-plan')} />
        <ReportTable title="Revenue by month" columns={['Month', 'Revenue', 'Payments']} rows={(reportData.revenueByMonth || []).map((item) => [item._id, formatPaise(item.totalPaise), item.payments])} onExport={() => exportReport('revenue-by-month')} />
        <ReportTable title="Points by month" columns={['Month', 'Issued', 'Spent']} rows={(reportData.pointsByMonth || []).map((item) => [item.month, formatPoints(item.issued), formatPoints(item.spent)])} onExport={() => exportReport('points-by-month')} />
      </div> : <EmptyState>No report data is available yet.</EmptyState>}
    </>}
  </section>;
}

function Drawer({ children, onClose }) {
  return <div className="fixed inset-0 z-40 bg-midnight/40" onClick={onClose} role="presentation"><aside className="absolute inset-y-0 right-0 w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}><button className="float-right mb-4 text-sm font-semibold text-forest" onClick={onClose}>Close ×</button><div className="clear-both">{children}</div></aside></div>;
}

function ReportTable({ title, columns, rows, onExport }) {
  return <Panel><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-xl">{title}</h2><Button variant="secondary" onClick={onExport}>Export CSV</Button></div>
    {!rows.length ? <EmptyState>No report rows are available.</EmptyState> : <div className="overflow-x-auto"><table className="w-full min-w-80 text-left text-sm"><thead><tr className="border-b border-slate-100 text-xs uppercase text-slate-500">{columns.map((column) => <th className="px-3 py-2" key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-b border-slate-100 last:border-0" key={`${row[0]}-${index}`}>{row.map((cell, cellIndex) => <td className="px-3 py-2" key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table></div>}
  </Panel>;
}
