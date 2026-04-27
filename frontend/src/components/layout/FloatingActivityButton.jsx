import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useActivitySessionStore } from '../../store/activitySessionStore';
import { Footprints } from 'lucide-react';
import styles from './FloatingActivityButton.module.css';

export function FloatingActivityButton() {
  const navigate = useNavigate();
  const location = useLocation();
  const { activeActivity, sessionState, elapsedSeconds } = useActivitySessionStore();

  // Only show when an activity is active AND we're NOT already on the session page
  if (!activeActivity || sessionState !== 'active' || location.pathname === '/activity') return null;

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <button className={styles.fab} onClick={() => navigate('/activity')}>
      <div className={styles.fabPulse}></div>
      <div className={styles.fabContent}>
        <Footprints size={22} />
        <div className={styles.fabText}>
          <span className={styles.fabTitle}>{activeActivity.title}</span>
          <span className={styles.fabTime}>{formatTime(elapsedSeconds)}</span>
        </div>
      </div>
    </button>
  );
}
