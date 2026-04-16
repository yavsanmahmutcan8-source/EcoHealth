import React from 'react';
import styles from './Button.module.css';

export function Button({ 
  children, 
  variant = 'primary', 
  isLoading = false, 
  className = '', 
  ...props 
}) {
  const baseClass = `${styles.button} ${styles[variant]} ${isLoading ? styles.loading : ''} ${className}`;
  
  return (
    <button className={baseClass.trim()} disabled={isLoading} {...props}>
      {isLoading ? (
        <span className={styles.spinner}>...</span>
      ) : children}
    </button>
  );
}
