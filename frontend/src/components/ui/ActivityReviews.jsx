import React, { useState, useEffect, useCallback } from 'react';
import { StarRating, RatingDisplay } from '../../components/ui/StarRating';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MessageSquare, ChevronDown, ChevronUp, Send, Trash2, User } from 'lucide-react';
import styles from './ActivityReviews.module.css';

export function ActivityReviews({ activityId }) {
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
      const res = await fetch(`/api/activities/${activityId}/reviews?sort=${sort}&order=${order}`);
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
  }, [activityId, sort, order, user]);

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
              reviews.map(review => (
                <div key={review.id} className={styles.reviewCard}>
                  <div className={styles.reviewHeader}>
                    <div className={styles.reviewer}>
                      <div className={styles.reviewerAvatar}><User size={14} /></div>
                      <span className={styles.reviewerName}>{review.username || 'User'}</span>
                      <span className={styles.reviewDate}>{formatDate(review.created_at)}</span>
                    </div>
                    <div className={styles.reviewRight}>
                      <StarRating rating={review.rating} readOnly size={14} />
                      {(review.user_id === user?.id || user?.is_admin) && (
                        <button className={styles.deleteBtn} onClick={() => handleDelete(review.id)} title="Delete review">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {review.comment && <p className={styles.reviewComment}>{review.comment}</p>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
