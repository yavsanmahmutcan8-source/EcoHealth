import React from 'react';
import styles from './Skeleton.module.css';

export function Skeleton({ className = '', variant = 'rect', width, height, ...props }) {
  const inlineStyles = {
    width: width || '100%',
    height: height || '1rem'
  };
  
  const variantClass = variant === 'circle' ? styles.circle : '';
  
  return (
    <div 
      className={`${styles.skeleton} ${variantClass} ${className}`} 
      style={inlineStyles}
      {...props}
    />
  );
}
