import React, { useState } from 'react';
import { Star } from 'lucide-react';
import styles from './StarRating.module.css';

export function StarRating({ rating = 0, onRate = null, size = 20, readOnly = false }) {
  const [hoverRating, setHoverRating] = useState(0);
  const interactive = !readOnly && onRate;

  return (
    <div 
      className={styles.container}
      onMouseLeave={() => interactive && setHoverRating(0)}
    >
      {[1, 2, 3, 4, 5].map(star => {
        const filled = star <= (hoverRating || rating);
        return (
          <button
            key={star}
            type="button"
            className={`${styles.star} ${filled ? styles.filled : styles.empty} ${interactive ? styles.interactive : ''}`}
            onClick={() => interactive && onRate(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            disabled={readOnly}
            aria-label={`${star} star${star > 1 ? 's' : ''}`}
          >
            <Star size={size} fill={filled ? 'currentColor' : 'none'} />
          </button>
        );
      })}
    </div>
  );
}

export function RatingDisplay({ average, count, size = 16 }) {
  if (!average && !count) return null;
  
  return (
    <div className={styles.ratingDisplay}>
      <div className={styles.starsRow}>
        {[1, 2, 3, 4, 5].map(star => (
          <Star 
            key={star} 
            size={size}
            className={star <= Math.round(average || 0) ? styles.filledDisplay : styles.emptyDisplay}
            fill={star <= Math.round(average || 0) ? 'currentColor' : 'none'}
          />
        ))}
      </div>
      <span className={styles.ratingText}>
        {average ? average.toFixed(1) : '—'} ({count || 0})
      </span>
    </div>
  );
}
