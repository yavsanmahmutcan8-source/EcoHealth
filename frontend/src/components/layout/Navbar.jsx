import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Navbar.module.css';
import { Leaf, User, Bell } from 'lucide-react';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useAuthStore } from '../../store/authStore';

export function Navbar() {
  const logout = useAuthStore(state => state.logout);
  const user = useAuthStore(state => state.user);
  const location = useLocation();

  return (
    <nav className={`glass ${styles.navbar}`}>
      <div className={styles.logo}>
        <Leaf size={24} className={styles.icon} />
        <span className="gradient-text">EcoHealth</span>
      </div>
      
      <div className={styles.navLinks}>
         <Link to="/dashboard" className={location.pathname === '/dashboard' ? styles.active : ''}>Dashboard</Link>
         <Link to="/explore" className={location.pathname === '/explore' ? styles.active : ''}>Explore</Link>
      </div>

      <div className={styles.actions}>
        <div style={{ position: 'relative' }}>
          <ThemeToggle />
        </div>
        <button className={styles.iconBtn}>
          <Bell size={20} />
        </button>
        <button className={styles.iconBtn} onClick={logout} title="Log Out" style={{ marginLeft: '-0.5rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Log Out</span>
        </button>
        <Link to="/profile" className={styles.avatar} title="View Profile">
          <User size={20} />
        </Link>
      </div>
    </nav>
  );
}
