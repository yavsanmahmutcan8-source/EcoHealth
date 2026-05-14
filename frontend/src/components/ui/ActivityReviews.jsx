import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarRating, RatingDisplay } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MessageSquare, ChevronDown, ChevronUp, Send, Trash2, User, EyeOff, Eye } from 'lucide-react';
import styles from './ActivityReviews.module.css';

export function ActivityReviews({ activityId, highlightReviewId }) {
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const addToast = useToastStore(state => state.addToast);
  
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(null);
  const [avgRating, setAvgRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [sort, setSort] = useState('date');
  const [order, setOrder] = useState('desc');
  
  // Form state
  const [newRating, setNewRating] = useState(0);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  const fetchRating = useCallback(async () => {
    try {
      const res = await fetch(`/api/activities/${activityId}/rating`);
      if (res.ok) {
        const data = await res.json();
        setAvgRating(data.average_rating);
        setReviewCount(data.review_count);
      }
    } catch {}
  }, [activityId]);

  const fetchReviews = useCallback(async () => {
    setLoading(true);
    try {
      // Pass auth so the backend can decide whether to surface hidden reviews
      // to the author / admin.
      const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`/api/activities/${activityId}/reviews?sort=${sort}&order=${order}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReviews(data);
        // Check if current user already reviewed
        if (user) {
          setHasReviewed(data.some(r => r.user_id === user.id));
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [activityId, sort, order, user, token]);

  useEffect(() => {
    if (activityId) {
      fetchRating();
      fetchReviews();
    }
  }, [activityId, fetchRating, fetchReviews]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newRating === 0) {
      addToast('Please select a star rating', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/activities/${activityId}/reviews`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: newRating, comment: newComment || null })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to submit review');
      }
      addToast('Review submitted! 🌟', 'success');
      setNewRating(0);
      setNewComment('');
      await fetchRating();
      await fetchReviews();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (reviewId) => {
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete');
      addToast('Review deleted', 'info');
      await fetchRating();
      await fetchReviews();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  const handleAdminHide = async (reviewId, hide) => {
    try {
      const url = `/api/admin/reviews/${reviewId}/${hide ? 'hide' : 'unhide'}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Action failed');
      }
      addToast(hide ? 'Comment hidden from other users' : 'Comment restored', 'success');
      await fetchReviews();
    } catch (err) {
      addToast(err.message, 'error');
    }
  };

  // Scroll + flash a target review when arriving via a notification link.
  useEffect(() => {
    if (!highlightReviewId || !expanded || loading) return;
    const el = document.getElementById(`review-${highlightReviewId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.highlightFlash || 'highlightFlash');
    }
  }, [highlightReviewId, expanded, loading, reviews]);

  // Auto-expand when a specific review is being targeted.
  useEffect(() => {
    if (highlightReviewId) setExpanded(true);
  }, [highlightReviewId]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className={styles.container}>
      {/* Summary bar — always visible */}
      <button className={styles.summaryBar} onClick={() => setExpanded(!expanded)}>
        <div className={styles.summaryLeft}>
          <MessageSquare size={18} />
          <span>Reviews</span>
          <RatingDisplay average={avgRating} count={reviewCount} size={14} />
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {expanded && (
        <div className={styles.body}>
          {/* Sort controls */}
          <div className={styles.sortBar}>
            <span className={styles.sortLabel}>Sort by:</span>
            <select 
              value={`${sort}_${order}`}
              onChange={(e) => {
                const [s, o] = e.target.value.split('_');
                setSort(s);
                setOrder(o);
              }}
              className={styles.sortSelect}
            >
              <option value="date_desc">Newest First</option>
              <option value="date_asc">Oldest First</option>
              <option value="rating_desc">Highest Rated</option>
              <option value="rating_asc">Lowest Rated</option>
            </select>
          </div>

          {/* Submit review form */}
          {!hasReviewed ? (
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formHeader}>
                <span>Your rating:</span>
                <StarRating rating={newRating} onRate={setNewRating} size={22} />
              </div>
              <textarea
                className={styles.textarea}
                placeholder="Share your experience (optional)..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={2}
              />
              <Button 
                variant="primary" 
                isLoading={submitting} 
                style={{ alignSelf: 'flex-end' }}
                type="submit"
              >
                <Send size={16} style={{ marginRight: '0.4rem' }} /> Submit Review
              </Button>
            </form>
          ) : (
            <div className={styles.alreadyReviewed}>
              ✅ You've already reviewed this activity.
            </div>
          )}

          {/* Reviews list */}
          <div className={styles.list}>
            {loading ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>Loading...</p>
            ) : reviews.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '1rem' }}>No reviews yet. Be the first!</p>
            ) : (
              reviews.map(review => {
                const isAuthor = review.user_id === user?.id;
                const isAdmin = !!user?.is_admin;
                const hidden = !!review.is_hidden;
                const isHighlighted = String(review.id) === String(highlightReviewId);
                return (
                  <div
                    key={review.id}
                    id={`review-${review.id}`}
                    className={styles.reviewCard}
                    style={{
                      opacity: hidden && !isAuthor && !isAdmin ? 0.5 : 1,
                      borderLeft: hidden ? '3px solid #E53935' : (isHighlighted ? '3px solid var(--color-primary)' : undefined),
                      background: hidden ? 'rgba(229,57,53,0.06)' : undefined,
                    }}
                  >
                    {hidden && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: '#E53935', fontWeight: 600, marginBottom: '0.4rem' }}>
                        <EyeOff size={13} />
                        {isAuthor
                          ? 'Removed by admin — this comment is hidden from other users.'
                          : 'Hidden by admin'}
                      </div>
                    )}
                    <div className={styles.reviewHeader}>
                      <div className={styles.reviewer}>
                        <div className={styles.reviewerAvatar}><User size={14} /></div>
                        {review.username ? (
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); navigate(`/profile/${review.username}`); }}
                            className={styles.reviewerName}
                            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                          >
                            @{review.username}
                          </button>
                        ) : (
                          <span className={styles.reviewerName}>User</span>
                        )}
                        <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                      </div>
                      <div className={styles.reviewRight}>
                        <StarRating rating={review.rating} readOnly size={14} />
                        {isAuthor && (
                          <button className={styles.deleteBtn} onClick={() => handleDelete(review.id)} title="Delete your review">
                            <Trash2 size={14} />
                          </button>
                        )}
                        {isAdmin && !isAuthor && !hidden && (
                          <button className={styles.deleteBtn} onClick={() => handleAdminHide(review.id, true)} title="Hide this comment from other users">
                            <EyeOff size={14} />
                          </button>
                        )}
                        {isAdmin && !isAuthor && hidden && (
                          <button className={styles.deleteBtn} onClick={() => handleAdminHide(review.id, false)} title="Restore this comment">
                            <Eye size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
