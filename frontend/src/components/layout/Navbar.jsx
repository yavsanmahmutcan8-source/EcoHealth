import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Navbar.module.css';
import { Leaf, User, Bell } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../store/authStore';

export function Navbar() {
  const user = useAuthStore(state => state.user);
  const location = useLocation();
  const navigate = useNavigate();

  const handleProfileClick = (e) => {
    e.preventDefault();
    console.log('[Navbar] Avatar clicked! Navigating from:', location.pathname, 'to: /profile');
    navigate('/profile');
  };

  return (
    <nav className={`glass ${styles.navbar}`}>
      <div className={styles.logo}>
        <Leaf size={24} className={styles.icon} />
        <span className="gradient-text">EcoHealth</span>
      </div>
      
      <div className={styles.navLinks}>
         <div onClick={() => navigate('/dashboard')} className={location.pathname === '/dashboard' ? styles.active : ''} style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>Dashboard</div>
         <div onClick={() => navigate('/explore')} className={location.pathname === '/explore' ? styles.active : ''} style={{cursor: 'pointer', color: 'var(--color-text-muted)'}}>Explore</div>
      </div>

      <div className={styles.actions}>
        <div style={{ position: 'relative' }}>
          <ThemeToggle />
        </div>
        <button className={styles.iconBtn}>
          <Bell size={20} />
        </button>
        <div className={styles.avatar} onClick={handleProfileClick} title="View Profile">
          <User size={20} />
        </div>
      </div>
    </nav>
  );
}
