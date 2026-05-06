import React, { useState, useEffect } from 'react';
import styles from './BadgeUnlockToast.module.css';

export function BadgeUnlockToast({ badges = [], onDismiss }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (badges.length === 0) return;
    
    const timer = setTimeout(() => {
      if (currentIndex < badges.length - 1) {
        setCurrentIndex(prev => prev + 1);
      } else {
        setVisible(false);
        setTimeout(() => onDismiss?.(), 300);
      }
    }, 4000);

    return () => clearTimeout(timer);
  }, [currentIndex, badges.length, onDismiss]);

  if (badges.length === 0 || !visible) return null;

  const badge = badges[currentIndex];

  return (
    <div className={`${styles.overlay} ${visible ? styles.show : styles.hide}`} onClick={() => { setVisible(false); setTimeout(() => onDismiss?.(), 300); }}>
      <div className={styles.card}>
        <div className={styles.glow} style={{ backgroundColor: badge.color || '#FFB300' }} />
        <div className={styles.confetti}>
          {Array.from({ length: 20 }).map((_, i) => (
            <span key={i} className={styles.particle} style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.5}s`,
              backgroundColor: ['#FFB300', '#FF5722', '#4CAF50', '#2196F3', '#E91E63', '#9C27B0'][i % 6]
            }} />
          ))}
        </div>
        <div className={styles.badge}>
          <span className={styles.emoji}>{badge.emoji || '🏆'}</span>
        </div>
        <div className={styles.label}>Badge Earned!</div>
        <h2 className={styles.title}>{badge.name}</h2>
        <p className={styles.desc}>{badge.description}</p>
        {badges.length > 1 && (
          <div className={styles.counter}>{currentIndex + 1} / {badges.length}</div>
        )}
        <span className={styles.tapHint}>Tap to dismiss</span>
      </div>
    </div>
  );
}
