import React from 'react';
import styles from './Input.module.css';

export const Input = React.forwardRef(({ 
  label, 
  error, 
  className = '', 
  wrapperClassName = '',
  ...props 
}, ref) => {
  return (
    <div className={`${styles.wrapper} ${error ? styles.error : ''} ${wrapperClassName}`}>
      {label && <label className={styles.label}>{label}</label>}
      <input 
        ref={ref}
        className={`${styles.input} ${className}`} 
        {...props} 
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
});

Input.displayName = 'Input';
