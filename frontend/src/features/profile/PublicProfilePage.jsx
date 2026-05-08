import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { ArrowLeft, MapPin, Trophy, Star, Compass, User as UserIcon, Loader } from 'lucide-react';
import { StarRating } from '../../components/ui/StarRating';
import styles from './PublicProfilePage.module.css';

const TABS = [
  { id: 'activities', label: 'Activities', icon: Compass },
  { id: 'created', label: 'Created Routes', icon: MapPin },
  { id: 'badges', label: 'Badges', icon: Trophy },
  { id: 'reviews', label: 'Reviews', icon: Star },
];

export function PublicProfilePage() {
  const { username } = useParams();
  const navigate = useNavigate();
  const me = useAuthStore(state => state.user);
  const addToast = useToastStore(state => state.addToast);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('activities');
  const [activities, setActivities] = useState([]);
  const [created, setCreated] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [badgeDefs, setBadgeDefs] = useState([]);
  const [tabLoading, setTabLoading] = useState(false);

  // Redirect to /profile if viewing own profile
  useEffect(() => {
    if (me && me.name === username) {
      navigate('/profile', { replace: true });
    }
  }, [me, username, navigate]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/users/${encodeURIComponent(username)}`)
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          throw new Error(e.detail || 'User not found');
        }
        return r.json();
      })
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((err) => {
        if (!cancelled) {
          addToast(err.message, 'error');
          navigate('/dashboard');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [username, navigate, addToast]);

  // Load badge definitions once for displaying badge metadata
  useEffect(() => {
    fetch('/api/badges').then(r => r.ok ? r.json() : []).then(setBadgeDefs).catch(() => {});
  }, []);

  useEffect(() => {
    if (!profile) return;
    setTabLoading(true);
    let url = '';
    if (activeTab === 'activities') url = `/api/users/${encodeURIComponent(username)}/activities`;
    else if (activeTab === 'created') url = `/api/users/${encodeURIComponent(username)}/created-activities`;
    else if (activeTab === 'reviews') url = `/api/users/${encodeURIComponent(username)}/reviews`;
    else { setTabLoading(false); return; }

    fetch(url)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (activeTab === 'activities') setActivities(data);
        else if (activeTab === 'created') setCreated(data);
        else if (activeTab === 'reviews') setReviews(data);
      })
      .catch(() => {})
      .finally(() => setTabLoading(false));
  }, [activeTab, profile, username]);

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <main className={styles.main}>
          <div className={styles.loading}><Loader className="spin" size={32} /></div>
        </main>
      </div>
    );
  }

  if (!profile) return null;

  const xpPct = Math.min((profile.xp / Math.max((profile.level || 1) * 200, 1)) * 100, 100);
  const earnedBadgeIds = profile.badges || [];
  const earnedBadges = badgeDefs.filter(b => earnedBadgeIds.includes(b.id));

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </button>

        <Card className={styles.headerCard}>
          <div className={styles.avatarWrap}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.username} className={styles.avatar} />
            ) : (
              <div className={styles.avatarFallback}><UserIcon size={36} /></div>
            )}
          </div>
          <div className={styles.profileMeta}>
            <h1 className="gradient-text">{profile.display_name || profile.username}</h1>
            <p className={styles.handle}>@{profile.username}</p>
            {profile.bio && <p className={styles.bio}>{profile.bio}</p>}
            <div className={styles.levelBar}>
              <span className={styles.levelBadge}>Level {profile.level}</span>
              <div className={styles.progressBg}>
                <div className={styles.progressFill} style={{ width: `${xpPct}%` }} />
              </div>
              <span className={styles.xpText}>{profile.xp} XP</span>
            </div>

            {profile.favorite_categories?.length > 0 && (
              <div className={styles.interestRow}>
                {profile.favorite_categories.map(c => (
                  <span key={c} className={styles.chip}>{c}</span>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className={styles.statsRow}>
          <Card className={styles.statCard}>
            <Compass size={20} className={styles.statIcon} />
            <div>
              <h3>{profile.activities_completed}</h3>
              <p>Completed</p>
            </div>
          </Card>
          <Card className={styles.statCard}>
            <MapPin size={20} className={styles.statIcon} />
            <div>
              <h3>{profile.activities_created}</h3>
              <p>Created</p>
            </div>
          </Card>
          <Card className={styles.statCard}>
            <Trophy size={20} className={styles.statIcon} />
            <div>
              <h3>{earnedBadgeIds.length}</h3>
              <p>Badges</p>
            </div>
          </Card>
          <Card className={styles.statCard}>
            <Star size={20} className={styles.statIcon} />
            <div>
              <h3>{profile.reviews_written}</h3>
              <p>Reviews</p>
            </div>
          </Card>
        </div>

        <div className={styles.tabs}>
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        <Card className={styles.tabPanel}>
          {tabLoading ? (
            <div className={styles.loading}><Loader className="spin" size={24} /></div>
          ) : (
            <>
              {activeTab === 'activities' && (
                activities.length === 0 ? (
                  <p className={styles.empty}>No completed activities yet.</p>
                ) : (
                  <ul className={styles.activityList}>
                    {activities.map(a => (
                      <li key={`${a.id}-${a.completed_at}`} className={styles.activityItem}>
                        <div>
                          <strong>{a.title}</strong>
                          <small>{a.category} · Difficulty {a.difficulty}/5</small>
                        </div>
                        <span className={styles.xpPill}>+{a.xp_reward || 50} XP</span>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {activeTab === 'created' && (
                created.length === 0 ? (
                  <p className={styles.empty}>Hasn't published any routes yet.</p>
                ) : (
                  <ul className={styles.activityList}>
                    {created.map(a => (
                      <li key={a.id} className={styles.activityItem}>
                        <div>
                          <strong>{a.title}</strong>
                          <small>{a.category} · Difficulty {a.difficulty}/5</small>
                        </div>
                        <span className={styles.xpPill}>+{a.xp_reward || 50} XP</span>
                      </li>
                    ))}
                  </ul>
                )
              )}

              {activeTab === 'badges' && (
                earnedBadges.length === 0 ? (
                  <p className={styles.empty}>No badges earned yet.</p>
                ) : (
                  <div className={styles.badgeGrid}>
                    {earnedBadges.map(b => (
                      <div key={b.id} className={styles.badgeCard} style={{ borderColor: b.color || 'var(--color-primary)' }}>
                        <div className={styles.badgeEmoji}>{b.emoji}</div>
                        <strong>{b.name}</strong>
                        <small>{b.description}</small>
                      </div>
                    ))}
                  </div>
                )
              )}

              {activeTab === 'reviews' && (
                reviews.length === 0 ? (
                  <p className={styles.empty}>No reviews written yet.</p>
                ) : (
                  <ul className={styles.reviewList}>
                    {reviews.map(r => (
                      <li key={r.id} className={styles.reviewItem}>
                        <div className={styles.reviewHeader}>
                          <StarRating rating={r.rating} readOnly size={14} />
                          <small>{r.created_at ? new Date(r.created_at).toLocaleDateString() : ''}</small>
                        </div>
                        {r.comment && <p>{r.comment}</p>}
                      </li>
                    ))}
                  </ul>
                )
              )}
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
