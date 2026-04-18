import React from 'react';
import { useThemeStore } from '../../store/themeStore';
import { Sun, Moon } from 'lucide-react';
import styles from './ThemeToggle.module.css';

export function ThemeToggle() {
  const { theme, toggleTheme } = useThemeStore();
  
  return (
    <button 
      className={styles.toggleBtn} 
      onClick={toggleTheme}
      title="Toggle Dark Mode"
      aria-label="Toggle Dark Mode"
    >
      {theme === 'dark' ? <Sun size={22} /> : <Moon size={22} />}
    </button>
  );
}
