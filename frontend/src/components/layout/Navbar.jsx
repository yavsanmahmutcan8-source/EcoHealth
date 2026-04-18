import React from 'react';
import styles from './Navbar.module.css';
import { Leaf, User, Bell } from 'lucide-react';

export function Navbar() {
  return (
    <nav className={`glass ${styles.navbar}`}>
      <div className={styles.logo}>
        <Leaf size={24} className={styles.icon} />
        <span className="gradient-text">EcoHealth</span>
      </div>
      
      <div className={styles.actions}>
        <button className={styles.iconBtn}>
          <Bell size={20} />
        </button>
        <div className={styles.avatar}>
          <User size={20} />
        </div>
      </div>
    </nav>
  );
}
