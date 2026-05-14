import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import styles from './ProfilePage.module.css';
import { User, Camera, Edit3, Save, ChevronDown, ChevronUp, MapPin, Clock, AlertCircle } from 'lucide-react';

const FITNESS_LEVELS = [
  { id: 'beginner', label: 'Beginner', emoji: '🌱' },
  { id: 'intermediate', label: 'Intermediate', emoji: '🚶' },
  { id: 'advanced', label: 'Advanced', emoji: '🏃' },
  { id: 'athlete', label: 'Athlete', emoji: '🏆' },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const fetchUser = useAuthStore(state => state.fetchUser);
  const updateInterests = useAuthStore(state => state.updateInterests);
  const addToast = useToastStore(state => state.addToast);

  const [badges, setBadges] = useState([]);
  const [progress, setProgress] = useState({});
  const [categories, setCategories] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [mySubmissions, setMySubmissions] = useState([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [interests, setInterests] = useState([]);
  const [healthOpen, setHealthOpen] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);

  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    fetch('/api/badges').then(r => r.ok ? r.json() : []).then(setBadges).catch(() => {});
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then(setCategories).catch(() => {});

    if (token) {
      fetch('/api/users/me/badge-progress', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : {}).then(setProgress).catch(() => {});

      setSubmissionsLoading(true);
      fetch('/api/users/me/activities', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : [])
        .then(setMySubmissions)
        .catch(() => {})
        .finally(() => setSubmissionsLoading(false));
    }
  }, [token]);

  const statusPill = (a) => {
    if (a.submission_status === 'changes_requested') {
      return { label: '📝 Needs Changes', bg: 'rgba(255,193,7,0.15)', color: '#b8860b', border: 'rgba(255,193,7,0.5)' };
    }
    if (a.submission_status === 'pending_review') {
      return { label: '⏳ In Review', bg: 'rgba(33,150,243,0.15)', color: '#1976d2', border: 'rgba(33,150,243,0.5)' };
    }
    if (a.visibility_state === 'draft') {
      return { label: '📄 Draft', bg: 'rgba(150,150,150,0.15)', color: '#666', border: 'rgba(150,150,150,0.5)' };
    }
    return { label: '✅ Published', bg: 'rgba(76,175,80,0.15)', color: '#388e3c', border: 'rgba(76,175,80,0.5)' };
  };

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setUsername(user.name || '');
      setAge(user.age != null ? String(user.age) : '');
      setSex(user.sex || '');
      setWeight(user.weight_kg != null ? String(user.weight_kg) : '');
      setHeight(user.height_cm != null ? String(user.height_cm) : '');
      setFitnessLevel(user.fitness_level || '');
      setInterests(user.favorite_categories || []);
    }
  }, [user, editOpen]);

  if (!user) return null;

  const earnedBadgeIds = user.badges || [];

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addToast('Image too large (max 2MB)', 'error');
      return;
    }
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const toggleInterest = (cat) => {
    setInterests(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // 1. Update profile fields (text + health)
      const payload = {
        display_name: displayName || null,
        bio: bio || null,
      };
      if (username && username !== user.name) payload.username = username;
      if (age) payload.age = parseInt(age, 10);
      if (sex) payload.sex = sex;
      if (weight) payload.weight_kg = parseFloat(weight);
      if (height) payload.height_cm = parseFloat(height);
      if (fitnessLevel) payload.fitness_level = fitnessLevel;

      const profileRes = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update profile');
      }

      // 2. Update interests if changed
      const currentInterests = user.favorite_categories || [];
      const interestsChanged =
        interests.length !== currentInterests.length ||
        interests.some(i => !currentInterests.includes(i));
      if (interestsChanged) {
        await updateInterests(interests);
      }

      // 3. Upload avatar if selected
      if (avatarFile) {
        const formData = new FormData();
        formData.append('file', avatarFile);
        const avatarRes = await fetch('/api/users/me/avatar', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
        });
        if (!avatarRes.ok) {
          const err = await avatarRes.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to upload avatar');
        }
      }

      addToast('Profile updated! ✨', 'success');
      setEditOpen(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      await fetchUser();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const avatarSrc = avatarPreview || user.avatar_url;

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.userHeader}>
          <div className={styles.avatarLarge} onClick={() => editOpen && fileRef.current?.click()}>
            {avatarSrc ? (
              <img src={avatarSrc} alt="Avatar" className={styles.avatarImg} />
            ) : (
              <User size={48} />
            )}
          </div>
          <div style={{ flex: 1 }}>
            <h1 className="gradient-text">{user.display_name || user.name}</h1>
            {user.display_name && <p className={styles.username}>@{user.name}</p>}
            <p className={styles.email}>{user.email}</p>
            {user.bio && <p className={styles.bio}>{user.bio}</p>}
            <div className={styles.levelTag}>Level {user.level} Explorer</div>
          </div>
          <div className={styles.headerActions}>
            <Button variant="secondary" onClick={() => setEditOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Edit3 size={16} /> Edit Profile
            </Button>
            <button
              type="button"
              onClick={() => useAuthStore.getState().logout()}
              className={styles.logoutBtn}
            >
              Log Out
            </button>
          </div>
        </div>

        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
            <h2 style={{ margin: 0 }}>My Submissions</h2>
            <Button variant="secondary" onClick={() => navigate('/create')}>+ New Route</Button>
          </div>
          <p className={styles.subtitle} style={{ marginTop: 0, marginBottom: '0.75rem' }}>
            Routes you've designed. Admin-reviewed before going live.
          </p>
          {submissionsLoading ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
          ) : mySubmissions.length === 0 ? (
            <Card>
              <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                You haven't created any routes yet. <button onClick={() => navigate('/create')} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}>Design your first route →</button>
              </p>
            </Card>
          ) : (
            <div style={{ display: 'grid', gap: '0.6rem' }}>
              {mySubmissions.map(a => {
                const pill = statusPill(a);
                const needsAttention = a.submission_status === 'changes_requested';
                return (
                  <Card key={a.id} style={{ borderColor: needsAttention ? 'rgba(255,193,7,0.5)' : undefined }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <strong style={{ fontSize: '1rem' }}>{a.title}</strong>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: 999, background: pill.bg, color: pill.color, border: `1px solid ${pill.border}` }}>
                            {pill.label}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                          <span><MapPin size={12} style={{ verticalAlign: 'middle' }} /> {a.category}</span>
                          <span>Diff {a.difficulty}/5</span>
                          <span><Clock size={12} style={{ verticalAlign: 'middle' }} /> ~{a.estimated_duration_minutes || 60} min</span>
                          <span>+{a.xp_reward || 50} XP</span>
                        </div>
                        {needsAttention && (
                          <p style={{ fontSize: '0.8rem', color: '#b8860b', margin: '0.5rem 0 0', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <AlertCircle size={13} /> Admin requested changes — open to view feedback and resubmit.
                          </p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <Button
                          variant={needsAttention ? 'primary' : 'secondary'}
                          onClick={() => navigate(`/create?edit=${a.id}`)}
                        >
                          {needsAttention ? 'Fix & Resubmit' : 'Edit'}
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.badgesSection}>
          <h2>Badge Gallery</h2>
          <p className={styles.subtitle}>
            {earnedBadgeIds.length} of {badges.length} badges earned — unlock more by exploring!
          </p>

          <div className={styles.badgeGrid}>
            {badges.map(badge => {
              const unlocked = earnedBadgeIds.includes(badge.id);
              const prog = progress[badge.id];
              const showProgress = prog && prog.target > 1 && !unlocked;

              return (
                <Card key={badge.id} className={`${styles.badgeCard} ${!unlocked ? styles.locked : ''}`}>
                  <div
                    className={`${styles.badgeIconWrapper} ${unlocked ? styles.unlocked : ''}`}
                    style={{ backgroundColor: unlocked ? badge.color : 'var(--glass-bg)' }}
                  >
                    <span style={{ fontSize: '1.75rem' }}>{badge.emoji}</span>
                  </div>
                  <div className={styles.badgeInfo}>
                    <h3>{badge.name}</h3>
                    <p>{badge.description}</p>
                    {showProgress && (
                      <div className={styles.progressContainer}>
                        <div className={styles.progressBar}>
                          <div
                            className={styles.progressFill}
                            style={{
                              width: `${Math.min((prog.current / prog.target) * 100, 100)}%`,
                              backgroundColor: badge.color
                            }}
                          />
                        </div>
                        <span className={styles.progressText}>{prog.current}/{prog.target}</span>
                      </div>
                    )}
                    {!unlocked && !showProgress && (
                      <span className={styles.lockedLabel}>🔒 Locked</span>
                    )}
                  </div>
                </Card>
              );
            })}
            {badges.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
                Loading badges...
              </p>
            )}
          </div>
        </section>
      </main>

      {/* Edit Profile Modal */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setAvatarFile(null); setAvatarPreview(null); }} title="Edit Profile">
        <div className={styles.editForm}>
          {/* Avatar upload */}
          <div className={styles.avatarUpload} onClick={() => fileRef.current?.click()}>
            {(avatarPreview || user.avatar_url) ? (
              <img src={avatarPreview || user.avatar_url} alt="Avatar" className={styles.avatarPreviewImg} />
            ) : (
              <div className={styles.avatarPlaceholder}><Camera size={28} /></div>
            )}
            <div className={styles.avatarOverlay}><Camera size={20} /> Change</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>

          <div className={styles.formField}>
            <label>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Your display name"
              className={styles.input}
            />
          </div>

          <div className={styles.formField}>
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="username"
              className={styles.input}
            />
          </div>

          <div className={styles.formField}>
            <label>Bio <span className={styles.charCount}>{(bio || '').length}/160</span></label>
            <textarea
              value={bio}
              onChange={e => { if (e.target.value.length <= 160) setBio(e.target.value); }}
              placeholder="Tell us about yourself..."
              className={styles.textarea}
              rows={3}
            />
          </div>

          {/* Health & Fitness collapsible */}
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setHealthOpen(!healthOpen)}
              style={{ width: '100%', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}
            >
              <span>🩺 Health & Fitness</span>
              {healthOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {healthOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginTop: '0.75rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className={styles.formField}>
                    <label>Age</label>
                    <input type="number" min="10" max="120" value={age} onChange={e => setAge(e.target.value)} className={styles.input} placeholder="28" />
                  </div>
                  <div className={styles.formField}>
                    <label>Sex</label>
                    <select value={sex} onChange={e => setSex(e.target.value)} className={styles.input}>
                      <option value="">Prefer not to say</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className={styles.formField}>
                    <label>Weight (kg)</label>
                    <input type="number" step="0.1" min="20" max="300" value={weight} onChange={e => setWeight(e.target.value)} className={styles.input} placeholder="70" />
                  </div>
                  <div className={styles.formField}>
                    <label>Height (cm)</label>
                    <input type="number" min="80" max="250" value={height} onChange={e => setHeight(e.target.value)} className={styles.input} placeholder="175" />
                  </div>
                </div>
                <div className={styles.formField}>
                  <label>Fitness level</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
                    {FITNESS_LEVELS.map(lvl => (
                      <button
                        key={lvl.id}
                        type="button"
                        onClick={() => setFitnessLevel(lvl.id)}
                        style={{
                          padding: '0.5rem',
                          borderRadius: '8px',
                          border: fitnessLevel === lvl.id ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                          background: fitnessLevel === lvl.id ? 'rgba(76, 175, 80, 0.12)' : 'var(--color-surface)',
                          color: 'var(--color-text)',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                        }}
                      >
                        {lvl.emoji} {lvl.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interests collapsible */}
          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '0.75rem' }}>
            <button
              type="button"
              onClick={() => setInterestsOpen(!interestsOpen)}
              style={{ width: '100%', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600 }}
            >
              <span>✨ My Interests ({interests.length})</span>
              {interestsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
            {interestsOpen && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.4rem', marginTop: '0.75rem' }}>
                {categories.length === 0 && <small style={{ color: 'var(--color-text-muted)' }}>Loading…</small>}
                {categories.map(cat => {
                  const selected = interests.includes(cat.name);
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleInterest(cat.name)}
                      style={{
                        padding: '0.55rem 0.4rem',
                        borderRadius: '10px',
                        border: selected ? `2px solid ${cat.color || 'var(--color-primary)'}` : '1px solid var(--glass-border)',
                        background: selected ? `${cat.color || '#4CAF50'}22` : 'var(--color-surface)',
                        color: 'var(--color-text)',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '1.15rem' }}>{cat.emoji}</div>
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <Button variant="primary" onClick={handleSaveProfile} isLoading={saving} style={{ width: '100%' }}>
            <Save size={16} style={{ marginRight: '0.4rem' }} /> Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
