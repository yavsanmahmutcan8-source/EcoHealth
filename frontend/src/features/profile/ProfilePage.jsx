import React, { useState, useEffect, useRef } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import styles from './ProfilePage.module.css';
import { User, Award, Camera, Edit3, Save, X } from 'lucide-react';

export function ProfilePage() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const fetchUser = useAuthStore(state => state.fetchUser);
  const addToast = useToastStore(state => state.addToast);

  const [badges, setBadges] = useState([]);
  const [progress, setProgress] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [username, setUsername] = useState('');
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    // Fetch badge definitions
    fetch('/api/badges').then(r => r.ok ? r.json() : []).then(setBadges).catch(() => {});
    
    // Fetch progress
    if (token) {
      fetch('/api/users/me/badge-progress', {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(r => r.ok ? r.json() : {}).then(setProgress).catch(() => {});
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setUsername(user.name || '');
    }
  }, [user]);

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

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      // 1. Update profile text fields
      const profileRes = await fetch('/api/users/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          display_name: displayName || null,
          bio: bio || null,
          username: username || undefined,
        })
      });
      if (!profileRes.ok) {
        const err = await profileRes.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update profile');
      }

      // 2. Upload avatar if selected
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

          <Button variant="primary" onClick={handleSaveProfile} isLoading={saving} style={{ width: '100%' }}>
            <Save size={16} style={{ marginRight: '0.4rem' }} /> Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
