import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { Leaf, User, Bell, Plus, Search } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationDropdown } from '../ui/NotificationDropdown';

function UserSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(() => {
      fetch(`/api/users/search?q=${encodeURIComponent(trimmed)}&limit=8`)
        .then(r => r.ok ? r.json() : [])
        .then(data => { setResults(data); setOpen(true); })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  const handleSelect = (username) => {
    setQuery('');
    setResults([]);
    setOpen(false);
    navigate(`/profile/${username}`);
  };

  return (
    <div className={styles.searchWrap} ref={wrapperRef}>
      <Search size={16} className={styles.searchIcon} />
      <input
        type="text"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Search users..."
        className={styles.searchInput}
      />
      {open && (loading || results.length > 0) && (
        <div className={styles.searchDropdown}>
          {loading && <div className={styles.searchEmpty}>Searching...</div>}
          {!loading && results.length === 0 && <div className={styles.searchEmpty}>No matches</div>}
          {!loading && results.map(u => (
            <button
              key={u.id}
              type="button"
              onClick={() => handleSelect(u.username)}
              className={styles.searchResult}
            >
              {u.avatar_url ? (
                <img src={u.avatar_url} alt="" className={styles.resultAvatar} />
              ) : (
                <div className={styles.resultAvatarFallback}><User size={14} /></div>
              )}
              <div className={styles.resultMeta}>
                <strong>{u.display_name || u.username}</strong>
                <small>@{u.username} · Lv {u.level}</small>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleProfileClick = (e) => {
    e.preventDefault();
    navigate('/profile');
  };

  useEffect(() => {
    if (token) {
      fetchNotifications(token);
      const interval = setInterval(() => fetchNotifications(token), 30000);
      return () => clearInterval(interval);
    }
  }, [token, fetchNotifications]);

  return (
    <nav className={`glass ${styles.navbar}`}>
      <div className={styles.logo}>
        <Leaf size={24} className={styles.icon} />
        <span className="gradient-text">EcoHealth</span>
      </div>

      <div className={styles.navLinks}>
        <div onClick={() => navigate('/dashboard')} className={location.pathname === '/dashboard' ? styles.active : ''} style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>Dashboard</div>
        <div onClick={() => navigate('/explore')} className={location.pathname === '/explore' ? styles.active : ''} style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>Explore</div>
        <div onClick={() => navigate('/create')} className={location.pathname === '/create' ? styles.active : ''} style={{ cursor: 'pointer', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <Plus size={14} /> Create
        </div>
        {user?.is_admin && (
          <div onClick={() => navigate('/admin')} className={location.pathname === '/admin' ? styles.active : ''} style={{ cursor: 'pointer', color: 'var(--color-text-muted)' }}>Admin</div>
        )}
      </div>

      <div className={styles.actions}>
        <UserSearch />
        <div style={{ position: 'relative' }}>
          <ThemeToggle />
        </div>
        <div style={{ position: 'relative' }}>
          <button className={styles.iconBtn} onClick={() => setShowNotifications(!showNotifications)}>
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className={styles.badge}>{unreadCount}</span>
            )}
          </button>
          <NotificationDropdown isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
        </div>
        <div className={styles.avatar} onClick={handleProfileClick} title="View Profile">
          {user?.avatar_url ? (
            <img src={user.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          ) : (
            <User size={20} />
          )}
        </div>
      </div>
    </nav>
  );
}
