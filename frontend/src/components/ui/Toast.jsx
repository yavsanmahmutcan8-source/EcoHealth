import React from 'react';
import { useToastStore } from '../../store/toastStore';
import styles from './Toast.module.css';
import { CheckCircle, XCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);
  
  if (toasts.length === 0) return null;

  return (
    <div className={styles.container}>
      {toasts.map((toast) => (
        <div key={toast.id} className={`${styles.toast} ${styles[toast.type]}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {toast.type === 'success' && <CheckCircle size={20} color="var(--color-primary)" />}
            {toast.type === 'error' && <XCircle size={20} color="#f44336" />}
            {toast.type === 'info' && <Info size={20} color="#2196f3" />}
            <span>{toast.message}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
