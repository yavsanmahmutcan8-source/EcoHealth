import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { Leaf, User, Bell } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { NotificationDropdown } from '../ui/NotificationDropdown';

export function Navbar() {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
  const { unreadCount, fetchNotifications } = useNotificationStore();
  const [showNotifications, setShowNotifications] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleProfileClick = (e) => {
    e.preventDefault();
    console.log('[Navbar] Avatar clicked! Navigating from:', location.pathname, 'to: /profile');
    navigate('/profile');
  };

  React.useEffect(() => {
    if (token) {
      fetchNotifications(token);
      // Poll every 30 seconds
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
         <div onClick={() => navigate('/dashboard')} className={location.pathname === '/dashboard' ? styles.active : ''} style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>Dashboard</div>
         <div onClick={() => navigate('/explore')} className={location.pathname === '/explore' ? styles.active : ''} style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>Explore</div>
         {user?.is_admin && (
           <div onClick={() => navigate('/admin')} className={location.pathname === '/admin' ? styles.active : ''} style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>Admin</div>
         )}
      </div>

      <div className={styles.actions}>
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
