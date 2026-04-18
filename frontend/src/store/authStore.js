import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      
      login: async (username, password) => {
        console.log('[Auth] Attempting live API login with username:', username);
        
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);

        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: formData
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Login failed');
        }

        const data = await response.json();
        const token = data.access_token;
        set({ token });
        
        await get().fetchUser();
      },
      
      register: async (username, email, password) => {
        console.log('[Auth] Attempting to register via API:', username);
        
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: username,
            email: email,
            password: password
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Registration failed');
        }
        
        // Auto-login after registration
        await get().login(username, password);
      },

      fetchUser: async () => {
        const token = get().token;
        if (!token) return;

        try {
          const response = await fetch('/api/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) {
            set({ user: null, token: null });
            throw new Error('Session expired');
          }
          
          const rawUser = await response.json();
          // Map backend User data to our expected frontend schema dynamically
          const formattedUser = {
            id: rawUser.id,
            name: rawUser.username,
            email: rawUser.email,
            level: rawUser.level || 1,
            xp: rawUser.xp || 0,
            max_xp: rawUser.level ? (rawUser.level) * 200 : 100,
            stats: {
              trails: 0,
              distance: 0,
              calories: '0',
              gold_badges: (rawUser.badges || []).length
            },
            badges: rawUser.badges || []
          };
          set({ user: formattedUser });
        } catch (error) {
          console.error('[Auth] Failed to fetch user profile:', error);
          set({ user: null, token: null });
        }
      },

      logout: () => {
        console.log('[Auth] LOGOUT triggered. Dropping API token and user state.');
        set({ user: null, token: null });
      }
    }),
    {
      name: 'auth-storage', // unique name
    }
  )
);
