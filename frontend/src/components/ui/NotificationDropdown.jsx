import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationStore } from '../../store/notificationStore';
import { useAuthStore } from '../../store/authStore';
import { Check, Trophy, ChevronUp, Bell, Activity, Info, Flag, MessageSquare, AlertTriangle, ChevronRight } from 'lucide-react';
import styles from './NotificationDropdown.module.css';

export function NotificationDropdown({ isOpen, onClose }) {
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, loading } = useNotificationStore();
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (token) {
      fetchNotifications(token);
    }
  }, [token, fetchNotifications]);

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = (type) => {
    switch (type) {
      case 'BADGE_EARNED': return <Trophy size={18} color="#FFD700" />;
      case 'LEVEL_UP': return <ChevronUp size={18} color="#4CAF50" />;
      case 'ACTIVITY_COMPLETED': return <Flag size={18} color="#4CAF50" />;
      case 'NEW_ACTIVITY': return <Activity size={18} color="#2196F3" />;
      case 'ACTIVITY_FEEDBACK': return <MessageSquare size={18} color="#FFA000" />;
      case 'ADMIN_WARNING': return <AlertTriangle size={18} color="#E53935" />;
      default: return <Info size={18} color="#9C27B0" />;
    }
  };

  return (
    <div className={styles.dropdown} ref={dropdownRef}>
      <div className={styles.header}>
        <h3>Notifications</h3>
        {unreadCount > 0 && (
          <button className={styles.markAllBtn} onClick={() => markAllAsRead(token)}>
            <Check size={14} /> Mark all read
          </button>
        )}
      </div>

      <div className={styles.list}>
        {loading && notifications.length === 0 ? (
          <div className={styles.empty}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div className={styles.empty}>
            <Bell size={24} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
            <p>No notifications yet</p>
          </div>
        ) : (
          notifications.map(notif => {
            const hasLink = !!notif.link;
            return (
              <div
                key={notif.id}
                className={`${styles.item} ${!notif.is_read ? styles.unread : ''}`}
                style={hasLink ? { cursor: 'pointer' } : undefined}
                onClick={() => {
                  if (!notif.is_read) markAsRead(notif.id, token);
                  if (hasLink) {
                    onClose();
                    navigate(notif.link);
                  }
                }}
              >
                <div className={styles.iconWrapper}>
                  {getIcon(notif.type)}
                </div>
                <div className={styles.content}>
                  <h4>{notif.title}</h4>
                  <p>{notif.message}</p>
                  <span className={styles.time}>
                    {new Date(notif.created_at).toLocaleDateString()}
                    {hasLink && (
                      <span style={{ marginLeft: '0.5rem', color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                        · View <ChevronRight size={12} />
                      </span>
                    )}
                  </span>
                </div>
                {!notif.is_read && <div className={styles.unreadDot} />}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
