import React from 'react';
import styles from './Card.module.css';

export function Card({ children, className = '', hoverable = false, ...props }) {
  const baseClass = `glass ${styles.card} ${hoverable ? 'hover-lift' : ''} ${className}`;
  
  return (
    <div className={baseClass.trim()} {...props}>
      {children}
    </div>
  );
}
