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
        <div className={styles.avatar} onClick={logout} title="Logout (Click to sign out)">
          <User size={20} />
        </div>
      </div>
    </nav>
  );
}
