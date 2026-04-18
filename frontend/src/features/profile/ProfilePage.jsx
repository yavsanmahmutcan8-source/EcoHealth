import React from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import styles from './ProfilePage.module.css';
import { User, Award, Map, Flame, Trophy } from 'lucide-react';

export function ProfilePage() {
  const user = useAuthStore(state => state.user);

  if (!user) return null;

  // We assign badges conditionally based on the "Testuser" vs "Fresh" mock strategy
  // If user xp > 0, we can mock unlocked badges.
  const hasBadges = user.xp > 0;

  const MOCK_BADGES = [
    { id: 1, name: 'First Steps', desc: 'Complete your first activity', unlocked: hasBadges, color: '#4caf50', icon: Map },
    { id: 2, name: 'Weekend Warrior', desc: 'Complete 3 activities on weekends', unlocked: hasBadges, color: '#ffb300', icon: Trophy },
    { id: 3, name: 'Trailblazer', desc: 'Hike 50 miles total', unlocked: false, color: '#f44336', icon: Flame },
    { id: 4, name: 'Early Bird', desc: 'Complete an activity before 7 AM', unlocked: false, color: '#2196f3', icon: Award },
  ];

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.userHeader}>
          <div className={styles.avatarLarge}>
            <User size={48} />
          </div>
          <div>
            <h1 className="gradient-text">{user.name}</h1>
            <p className={styles.email}>{user.email}</p>
            <div className={styles.levelTag}>Level {user.level} Explorer</div>
          </div>
        </div>

        <section className={styles.badgesSection}>
          <h2>Badge Gallery</h2>
          <p className={styles.subtitle}>Unlock achievements by exploring new activities.</p>
          
          <div className={styles.badgeGrid}>
            {MOCK_BADGES.map(badge => {
              const Icon = badge.icon;
              return (
                <Card key={badge.id} className={`${styles.badgeCard} ${!badge.unlocked ? styles.locked : ''}`}>
                  <div 
                    className={styles.badgeIconWrapper} 
                    style={{ backgroundColor: badge.unlocked ? badge.color : 'var(--glass-bg)' }}
                  >
                    <Icon size={32} color={badge.unlocked ? '#fff' : 'var(--color-text-muted)'} />
                  </div>
                  <div className={styles.badgeInfo}>
                    <h3>{badge.name}</h3>
                    <p>{badge.desc}</p>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
