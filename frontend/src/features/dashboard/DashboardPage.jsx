import React from 'react';
import styles from './DashboardPage.module.css';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { MapPin, Activity, Flame, Trophy } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';

const mockActivities = [
  { id: 1, title: 'Sunrise Mountain Hike', difficulty: 'Moderate', time: '2 hrs', image: '🏔️' },
  { id: 2, title: 'Lakeside Jogging', difficulty: 'Easy', time: '45 mins', image: '🏃' },
  { id: 3, title: 'Deep Forest Trail', difficulty: 'Hard', time: '3.5 hrs', image: '🌲' },
];

export function DashboardPage() {
  const user = useAuthStore(state => state.user);

  if (!user) return null;

  const progressPercentage = Math.min((user.xp / user.max_xp) * 100, 100);

  return (
    <div className={styles.container}>
      <Navbar />
      
      <main className={styles.main}>
        <header className={styles.welcomeSection}>
          <div>
            <h1 className="gradient-text">Welcome back, {user.name.split(' ')[0]}!</h1>
            <p>You're {user.max_xp - user.xp} XP away from Level {user.level + 1}. Get out there!</p>
          </div>
          
          <Card className={styles.xpCard}>
            <div className={styles.xpHeader}>
              <span className={styles.levelBadge}>Level {user.level}</span>
              <span className={styles.xpText}>{user.xp} / {user.max_xp} XP</span>
            </div>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: `${progressPercentage}%` }}></div>
            </div>
          </Card>
        </header>

        <section className={styles.statsGrid}>
          <Card className={styles.statCard}>
            <MapPin className={styles.statIcon} color="#2196f3" />
            <div className={styles.statInfo}>
              <h3>{user.stats.trails}</h3>
              <p>Trails Conquered</p>
            </div>
          </Card>
          <Card className={styles.statCard}>
            <Activity className={styles.statIcon} color="var(--color-primary)" />
            <div className={styles.statInfo}>
              <h3>{user.stats.distance} mi</h3>
              <p>Distance Logged</p>
            </div>
          </Card>
          <Card className={styles.statCard}>
            <Flame className={styles.statIcon} color="#ff9800" />
            <div className={styles.statInfo}>
              <h3>{user.stats.calories}</h3>
              <p>Calories Burned</p>
            </div>
          </Card>
          <Card className={styles.statCard}>
            <Trophy className={styles.statIcon} color="var(--color-accent)" />
            <div className={styles.statInfo}>
              <h3>{user.stats.gold_badges}</h3>
              <p>Gold Badges</p>
            </div>
          </Card>
        </section>

        <section className={styles.carouselSection}>
          <h2>Picked For You</h2>
          <p className={styles.subtitle}>Based on your recent activity and fitness level</p>
          
          <div className={styles.carousel}>
            {mockActivities.map(activity => (
              <Card key={activity.id} className={styles.activityCard} hoverable>
                <div className={styles.activityImage}>{activity.image}</div>
                <div className={styles.activityDetails}>
                  <h3>{activity.title}</h3>
                  <div className={styles.activityMeta}>
                    <span className={styles.difficulty}>{activity.difficulty}</span>
                    <span className={styles.time}>{activity.time}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
