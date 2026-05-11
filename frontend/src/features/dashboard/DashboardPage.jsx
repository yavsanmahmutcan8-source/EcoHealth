import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './DashboardPage.module.css';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ActivityReviews } from '../../components/ui/ActivityReviews';
import { MapPin, Activity, Flame, Trophy, Loader, Play, Info } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useAuthStore } from '../../store/authStore';
import { useActivitySessionStore } from '../../store/activitySessionStore';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function formatReason(reason) {
  switch (reason) {
    case 'favorite_category': return '✨ Matches your favorite category';
    case 'already_completed': return '↩️ You\'ve already completed this';
    default: return reason;
  }
}

function MatchReasonsTooltip({ reasons, score }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        style={{ background: 'none', border: 'none', padding: 0, marginLeft: 4, cursor: 'pointer', color: 'var(--color-text-muted)', display: 'inline-flex' }}
        aria-label="Why this match?"
      >
        <Info size={13} />
      </button>
      {open && (
        <span style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          right: '-8px',
          background: 'var(--color-surface, #222)',
          color: 'var(--color-text)',
          border: '1px solid var(--glass-border)',
          padding: '0.5rem 0.7rem',
          borderRadius: 8,
          fontSize: '0.72rem',
          whiteSpace: 'nowrap',
          zIndex: 10,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          <strong>Why {score}% match?</strong>
          <ul style={{ margin: '0.25rem 0 0', padding: '0 0 0 0.85rem' }}>
            <li>Tuned to your fitness level</li>
            {reasons?.includes('favorite_category') && <li>{formatReason('favorite_category')}</li>}
            {reasons?.includes('already_completed') && <li>{formatReason('already_completed')}</li>}
          </ul>
        </span>
      )}
    </span>
  );
}

export function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const [recommendations, setRecommendations] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewActivity, setPreviewActivity] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | category name
  const { startActivity, activeActivity, sessionState } = useActivitySessionStore();

  const emojiMap = {};
  categories.forEach(c => { emojiMap[c.name] = c.emoji; });
  const getEmoji = (category) => emojiMap[category] || '📍';

  useEffect(() => {
    async function loadRecommendations() {
      if (!token) return;
      try {
        const res = await fetch('/api/dashboard/recommendations', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setRecommendations(data.picked_for_you || []);
        }
      } catch (err) {
        console.error('Failed to fetch recommendations', err);
      } finally {
        setLoading(false);
      }
    }
    loadRecommendations();
  }, [token]);

  useEffect(() => {
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then(setCategories).catch(() => {});
  }, []);

  const favorites = user?.favorite_categories || [];
  const filterChips = useMemo(() => {
    const baseChips = ['all', ...favorites];
    return baseChips;
  }, [favorites]);

  const filteredRecommendations = useMemo(() => {
    if (filter === 'all') return recommendations;
    return recommendations.filter(r => r.category === filter);
  }, [recommendations, filter]);

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
              <h3>{Number(user.stats.distance || 0).toFixed(1)} km</h3>
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
          <p className={styles.subtitle}>Based on your fitness level{favorites.length ? ', interests' : ''} and history</p>

          {favorites.length > 0 && (
            <div className={styles.filterRow}>
              {filterChips.map(chip => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setFilter(chip)}
                  className={`${styles.filterChip} ${filter === chip ? styles.filterChipActive : ''}`}
                >
                  {chip === 'all' ? 'All' : `${getEmoji(chip)} ${chip}`}
                </button>
              ))}
            </div>
          )}

          <div className={styles.carousel}>
            {loading ? (
              <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center', width: '100%', color: 'var(--color-text-muted)' }}>
                <Loader className="spin" size={32} />
              </div>
            ) : filteredRecommendations.length > 0 ? (
              filteredRecommendations.map(activity => (
                <Card key={activity.id} className={styles.activityCard} hoverable>
                  <div className={styles.activityImage}>
                    {getEmoji(activity.category)}
                    {activity.creator_is_admin && (
                      <span className={styles.officialBadge} title="Official EcoHealth Route">🏛️ Official</span>
                    )}
                  </div>
                  <div className={styles.activityDetails}>
                    <h3>{activity.title}</h3>
                    {activity.creator_username && !activity.creator_is_admin && (
                      <small style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                        by{' '}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/profile/${activity.creator_username}`); }}
                          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', padding: 0, cursor: 'pointer', font: 'inherit' }}
                        >
                          @{activity.creator_username}
                        </button>
                      </small>
                    )}
                    <div className={styles.activityMeta}>
                      <span className={styles.difficulty}>
                        {activity.match_score_percentage}% Match
                        <MatchReasonsTooltip reasons={activity.match_reasons} score={activity.match_score_percentage} />
                      </span>
                      <span className={styles.time}>+{activity.xp_reward || 50} XP</span>
                    </div>
                    <Button
                      variant="primary"
                      style={{ width: '100%', marginTop: '0.75rem' }}
                      onClick={() => setPreviewActivity(activity)}
                    >
                      <Play size={16} style={{ marginRight: '0.5rem' }} /> View & Start
                    </Button>
                  </div>
                </Card>
              ))
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', width: '100%', color: 'var(--color-text-muted)' }}>
                {filter === 'all'
                  ? 'No recommendations found. Keep exploring to teach the algorithm!'
                  : `No ${filter} activities right now — try another filter.`}
              </div>
            )}
          </div>
        </section>
      </main>

      <Modal isOpen={!!previewActivity} onClose={() => setPreviewActivity(null)} title={previewActivity?.title || 'Activity Details'}>
        {previewActivity && (
          <div style={{ textAlign: 'center' }}>
            {previewActivity.creator_username && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {previewActivity.creator_is_admin ? '🏛️ Official Route' : (
                  <>
                    Created by{' '}
                    <button
                      type="button"
                      onClick={() => { setPreviewActivity(null); navigate(`/profile/${previewActivity.creator_username}`); }}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', padding: 0, cursor: 'pointer', font: 'inherit' }}
                    >
                      @{previewActivity.creator_username}
                    </button>
                  </>
                )}
              </p>
            )}

            <div style={{ height: '220px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
              <MapContainer
                center={[previewActivity.latitude || 39.92, previewActivity.longitude || 32.85]}
                zoom={14}
                scrollWheelZoom={false}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {previewActivity.latitude && (
                  <Marker position={[previewActivity.latitude, previewActivity.longitude]}>
                    <Popup>🏁 Start Point</Popup>
                  </Marker>
                )}
                {(() => {
                  try {
                    const pts = JSON.parse(previewActivity.route_polyline);
                    if (pts.length > 1) return <Polyline positions={pts} color="#4CAF50" weight={4} />;
                  } catch {}
                  return null;
                })()}
              </MapContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>Category</small>
                <p style={{ margin: 0, fontWeight: 600 }}>{previewActivity.category}</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>Difficulty</small>
                <p style={{ margin: 0, fontWeight: 600 }}>{previewActivity.difficulty}/5</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>XP Reward</small>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-primary)' }}>+{previewActivity.xp_reward || 50} XP</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>Duration</small>
                <p style={{ margin: 0, fontWeight: 600 }}>~{previewActivity.estimated_duration_minutes || 60} min</p>
              </div>
            </div>

            {activeActivity && sessionState === 'active' ? (
              <p style={{ color: '#f44336', fontSize: '0.875rem', marginBottom: '1rem' }}>
                ⚠️ You already have an active activity. Complete or abandon it first.
              </p>
            ) : (
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={() => {
                  startActivity(previewActivity);
                  setPreviewActivity(null);
                  navigate('/activity');
                }}
              >
                <Play size={18} style={{ marginRight: '0.5rem' }} /> Start Activity
              </Button>
            )}

            <ActivityReviews activityId={previewActivity.id} />
          </div>
        )}
      </Modal>
    </div>
  );
}
