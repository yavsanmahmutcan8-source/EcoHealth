import React, { useState } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapPin, Trophy, Star, ChevronUp } from 'lucide-react';
import styles from './ActiveSessionModal.module.css';

export function ActiveSessionModal({ activity, isOpen, onClose }) {
  const [step, setStep] = useState('confirm'); // 'confirm', 'locating', 'success'
  const [result, setResult] = useState(null);
  const token = useAuthStore(state => state.token);
  const fetchUser = useAuthStore(state => state.fetchUser);
  const addToast = useToastStore(state => state.addToast);

  const handleComplete = async () => {
    setStep('locating');
    
    // Simulate location prompt
    try {
      await new Promise((resolve) => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(resolve, resolve, { timeout: 2000 });
        } else {
          resolve();
        }
      });
    } catch (e) {
      console.warn('Geolocation failed/denied, proceeding anyway for demo');
    }

    try {
      const res = await fetch(`/api/activities/${activity.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Failed to complete activity');
      }

      const data = await res.json();
      setResult(data);
      await fetchUser(); // Update global state
      setStep('success');
    } catch (err) {
      addToast(err.message || 'Error completing activity', 'error');
      setStep('confirm');
    }
  };

  const handleClose = () => {
    setStep('confirm');
    setResult(null);
    onClose();
  };

  if (!activity) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={step === 'success' ? 'Activity Complete!' : 'Complete Activity'}>
      {step === 'confirm' && (
        <div className={styles.confirmState}>
          <div className={styles.iconWrapper}>
            <MapPin size={48} className={styles.pinIcon} />
          </div>
          <h3>{activity.title}</h3>
          <p>Are you sure you want to complete this activity?</p>
          <div className={styles.rewardsPreview}>
            <span className={styles.rewardTag}>+{activity.xp_reward || 50} XP</span>
          </div>
          <Button variant="primary" onClick={handleComplete} style={{ width: '100%', marginTop: '1rem' }}>
            Verify Location & Complete
          </Button>
        </div>
      )}

      {step === 'locating' && (
        <div className={styles.locatingState}>
          <div className={styles.spinner}></div>
          <p>Verifying location...</p>
        </div>
      )}

      {step === 'success' && result && (
        <div className={styles.successState}>
          <div className={styles.successAnimation}>
            <Trophy size={64} className={styles.trophyIcon} />
          </div>
          <h3 className="gradient-text">Great Job!</h3>
          <p>You have earned rewards for completing this activity.</p>
          
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <Star className={styles.statIcon} />
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>New XP</span>
                <span className={styles.statValue}>{result.new_xp}</span>
              </div>
            </div>
            <div className={styles.statCard}>
              <ChevronUp className={styles.statIcon} />
              <div className={styles.statInfo}>
                <span className={styles.statLabel}>Level</span>
                <span className={styles.statValue}>{result.new_level}</span>
              </div>
            </div>
          </div>

          {result.leveled_up && (
            <div className={styles.levelUpBanner}>
              🎉 LEVEL UP! You reached Level {result.new_level}!
            </div>
          )}

          {result.newly_unlocked_badges && result.newly_unlocked_badges.length > 0 && (
            <div className={styles.badgesSection}>
              <h4>New Badges Unlocked</h4>
              <div className={styles.badgeList}>
                {result.newly_unlocked_badges.map(badge => (
                  <div key={badge.id} className={styles.badgeItem}>
                    <div className={styles.badgeIcon}>🏅</div>
                    <div className={styles.badgeDetails}>
                      <span className={styles.badgeName}>{badge.name}</span>
                      <span className={styles.badgeDesc}>{badge.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button variant="secondary" onClick={handleClose} style={{ width: '100%', marginTop: '1.5rem' }}>
            Close
          </Button>
        </div>
      )}
    </Modal>
  );
}
