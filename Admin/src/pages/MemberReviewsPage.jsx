import { useCallback, useEffect, useMemo, useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import { adminApi } from '../api/admin.js';
import { errorMessage } from '../api/client.js';
import { Button, ConfirmDialog, DataTable, EmptyState, LoadingState, PageHeading, Pagination, Toast, formatDate } from '../components/ui.jsx';

const pageSize = 20;

export default function MemberReviewsPage() {
  const [data, setData] = useState(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (nextPage) => {
    setData(null);
    setError('');
    try {
      setData(await adminApi.memberReviews({ page: nextPage, limit: pageSize }));
      setPage(nextPage);
    } catch (failure) {
      setError(errorMessage(failure));
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  async function confirmDelete() {
    if (!selected) return;
    setDeleting(true);
    setError('');
    setNotice('');
    try {
      await adminApi.deleteMemberReview(selected._id);
      setSelected(null);
      setNotice(`Review by ${selected.memberName} was deleted. It is removed from the home page, and the member can submit a new review.`);
      await load(data?.items?.length === 1 && page > 1 ? page - 1 : page);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setDeleting(false);
    }
  }

  const columns = useMemo(() => [
    { key: 'memberName', label: 'Member' },
    { key: 'rating', label: 'Rating', render: (review) => <span className="inline-flex items-center gap-1 whitespace-nowrap text-amber-600" aria-label={`${review.rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => <Star key={index} size={15} fill={index < review.rating ? 'currentColor' : 'none'} />)}
      <span className="ml-1 text-slate-600">{review.rating}/5</span>
    </span> },
    { key: 'message', label: 'Review', render: (review) => <p className="max-w-3xl whitespace-pre-wrap break-words">{review.message}</p> },
    { key: 'createdAt', label: 'Submitted', render: (review) => formatDate(review.createdAt) },
    { key: 'actions', label: 'Actions', render: (review) => <Button variant="danger" className="px-3 py-2" onClick={() => setSelected(review)} aria-label={`Delete review by ${review.memberName}`}><Trash2 size={15} />Delete</Button> },
  ], []);

  return <section>
    <PageHeading eyebrow="MEMBERSHIP" title="Member Reviews" description="Review ratings and messages submitted by members. Deleting a review removes it from the public Stories section and clears it from the member dashboard." />
    {notice && <Toast onDismiss={() => setNotice('')}>{notice}</Toast>}
    {error && <Toast kind="error" onDismiss={() => setError('')}>{error}</Toast>}
    {!data && !error && <LoadingState />}
    {data && <>
      <div className="mb-4 flex items-center justify-between text-sm text-slate-500"><span>{data.total} reviews</span></div>
      {data.items.length
        ? <DataTable columns={columns} rows={data.items} />
        : <EmptyState>No member reviews have been submitted yet.</EmptyState>}
      <Pagination info={data} onPage={load} />
    </>}
    {selected && <ConfirmDialog
      title="Delete this review?"
      onCancel={() => setSelected(null)}
      onConfirm={confirmDelete}
      confirmLabel="Delete review"
      busy={deleting}
    >This will remove {selected.memberName}’s {selected.rating}-star review from the home page. The member dashboard review form will be cleared, and they can submit a new review later.</ConfirmDialog>}
  </section>;
}
