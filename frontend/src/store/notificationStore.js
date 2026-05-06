import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,

  fetchNotifications: async (token) => {
    if (!token) return;
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch notifications');
      const data = await res.json();
      
      const unreadCount = data.filter(n => !n.is_read).length;
      
      set({ notifications: data, unreadCount, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  markAsRead: async (notifId, token) => {
    try {
      const res = await fetch(`/api/notifications/${notifId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        set(state => {
          const updated = state.notifications.map(n => 
            n.id === notifId ? { ...n, is_read: true } : n
          );
          return {
            notifications: updated,
            unreadCount: updated.filter(n => !n.is_read).length
          };
        });
      }
    } catch (err) {
      console.error('Failed to mark read', err);
    }
  },

  markAllAsRead: async (token) => {
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, is_read: true })),
          unreadCount: 0
        }));
      }
    } catch (err) {
      console.error('Failed to mark all read', err);
    }
  }
}));
