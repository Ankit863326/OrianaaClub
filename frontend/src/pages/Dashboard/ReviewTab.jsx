import { useCallback, useEffect, useRef, useState } from 'react';
import useAutoRefresh from '../../hooks/useAutoRefresh.js';
import { getMyReview, saveMyReview } from './memberDashboardApi.js';

export default function ReviewTab({ onSessionExpired }) {
  const [reviewState, setReviewState] = useState(null);
  const [rating, setRating] = useState(0);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const savedReviewRef = useRef(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true);
      setError('');
    }
    try {
      const result = await getMyReview();
      if (silent) {
        if (savedReviewRef.current && !result.review) {
          savedReviewRef.current = null;
          setReviewState(result);
          setRating(0);
          setMessage('');
          setNotice('Your review was removed by an administrator. You can submit a new review.');
        }
        return;
      }
      savedReviewRef.current = result.review?._id || null;
      setReviewState(result);
      setRating(result.review?.rating || 0);
      setMessage(result.review?.message || '');
    } catch (failure) {
      if (!silent) {
        if (failure.status === 401) onSessionExpired();
        setError(failure.message || 'Could not load your review.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(() => load({ silent: true }), { enabled: Boolean(reviewState?.review) });

  async function submit(event) {
    event.preventDefault();
    if (rating < 1 || rating > 5) {
      setError('Choose a star rating before submitting.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const review = await saveMyReview({ rating, message });
      savedReviewRef.current = review?._id || 'saved';
      setReviewState({ eligible: true, review });
      setNotice('Thank you. Your review is now visible in Stories on the home page.');
    } catch (failure) {
      if (failure.status === 401) onSessionExpired();
      setError(failure.message || 'Could not submit your review.');
    } finally {
      setSaving(false);
    }
  }

  return <section className="member-hub__panel">
    <h2>Share your experience</h2>
    {loading ? <p className="member-hub__loading" role="status">Loading your review…</p> : <>
      {error && <p className="member-hub__warning" role="alert">{error}</p>}
      {notice && <p className="member-hub__notice" role="status">{notice}</p>}
      {!reviewState?.eligible ? <div className="member-hub__empty">
        A confirmed membership payment is required before you can submit a review.
      </div> : <form className="member-review-form" onSubmit={submit}>
        <p className="member-hub__subtle">Your review will appear in the Stories section on the home page.</p>
        <fieldset className="member-review-form__rating">
          <legend>Your rating</legend>
          <div role="group" aria-label="Choose a rating from one to five stars">
            {[1, 2, 3, 4, 5].map((value) => <button
              key={value}
              type="button"
              className="member-review-form__star"
              aria-label={`${value} ${value === 1 ? 'star' : 'stars'}`}
              aria-pressed={rating === value}
              onClick={() => setRating(value)}
            >{value <= rating ? '★' : '☆'}</button>)}
          </div>
        </fieldset>
        <label className="member-review-form__message">Your review
          <textarea
            value={message}
            minLength={10}
            maxLength={1200}
            required
            rows={6}
            placeholder="Tell us what made your Saptagiri Resorts experience memorable…"
            onChange={(event) => setMessage(event.target.value)}
          />
          <span className="member-hub__subtle">{message.length}/1200 characters</span>
        </label>
        <button className="member-hub__retry" type="submit" disabled={saving || rating === 0}>
          {saving ? 'Submitting…' : reviewState.review ? 'Update review' : 'Submit review'}
        </button>
      </form>}
    </>}
  </section>;
}
