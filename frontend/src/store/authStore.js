import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const TEST_USER_DATA = {
  name: 'Test Explorer',
  email: 'testuser',
  level: 4,
  xp: 760,
  max_xp: 1000,
  stats: {
    trails: 12,
    distance: 48.2,
    calories: '14K',
    gold_badges: 3
  }
};

const FRESH_USER_DATA = (name, email) => ({
  name: name || 'New Explorer',
  email: email,
  level: 1,
  xp: 0,
  max_xp: 100,
  stats: {
    trails: 0,
    distance: 0,
    calories: '0',
    gold_badges: 0
  }
});

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      login: (email, password) => {
        console.log('[Auth] Attempting login with email:', email);
        if (email === 'testuser' && password === 'testuser123') {
          console.log('[Auth] Test user successfully matched.');
          set({ user: TEST_USER_DATA });
          return true;
        } else {
          console.log('[Auth] Fallback fresh user matched.');
          set({ user: FRESH_USER_DATA('User', email) });
          return true;
        }
      },
      register: (name, email) => {
        console.log('[Auth] Registering user:', email);
        set({ user: FRESH_USER_DATA(name, email) });
        return true;
      },
      logout: () => {
        console.log('[Auth] LOGOUT triggered. Dropping user state.');
        set({ user: null });
      }
    }),
    {
      name: 'auth-storage', // unique name
    }
  )
);
