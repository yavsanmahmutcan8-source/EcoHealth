import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Hard cap on a stored session, in ms. Matches the backend ACCESS_TOKEN_EXPIRE
// (7 days). If a user comes back after this we drop the token client-side so
// they hit /auth cleanly instead of looping on a 401 from a stale token —
// which used to leave them stuck on the onboarding screen with no escape.
const MAX_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      tokenIssuedAt: null,

      // Drop session and bounce to /auth. Used by 401 handlers across the
      // store so a stuck user is never trapped on a token-gated page.
      forceLogout: (reason) => {
        if (reason) console.warn('[Auth] Forced logout:', reason);
        set({ user: null, token: null, tokenIssuedAt: null });
        if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
          window.location.replace('/auth');
        }
      },

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
        set({ token, tokenIssuedAt: Date.now() });

        await get().fetchUser();
      },

      googleLogin: async (credential) => {
        const response = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ credential })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.detail || 'Google Login failed');
        }
        const data = await response.json();
        const token = data.access_token;
        set({ token, tokenIssuedAt: Date.now() });
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

      updateProfile: async (payload) => {
        const token = get().token;
        if (!token) throw new Error('Not authenticated');
        const response = await fetch('/api/users/me/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (response.status === 401) {
          get().forceLogout('updateProfile 401');
          throw new Error('Your session has expired. Please log in again.');
        }
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to update profile');
        }
        await get().fetchUser();
      },

      updateInterests: async (favoriteCategories) => {
        const token = get().token;
        if (!token) throw new Error('Not authenticated');
        const response = await fetch('/api/users/me/interests', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ favorite_categories: favoriteCategories }),
        });
        if (response.status === 401) {
          get().forceLogout('updateInterests 401');
          throw new Error('Your session has expired. Please log in again.');
        }
        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.detail || 'Failed to save interests');
        }
        await get().fetchUser();
      },

      fetchUser: async () => {
        const token = get().token;
        if (!token) return;

        // Pre-emptive expiry: if the stored session is older than the backend
        // token lifetime, ditch it now instead of pinging the API with a dead
        // bearer. Prevents the mobile-Safari "stuck on onboarding" trap.
        const issuedAt = get().tokenIssuedAt;
        if (issuedAt && Date.now() - issuedAt > MAX_SESSION_MS) {
          get().forceLogout('token max age exceeded');
          return;
        }

        try {
          const response = await fetch('/api/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.status === 401) {
            get().forceLogout('fetchUser 401');
            return;
          }
          if (response.status === 403) {
            // Banned-user enforcement (backend deps.get_current_user)
            get().forceLogout('account banned');
            return;
          }
          if (!response.ok) {
            set({ user: null, token: null, tokenIssuedAt: null });
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
            display_name: rawUser.display_name || null,
            bio: rawUser.bio || null,
            avatar_url: rawUser.avatar_url || null,
            // Health & fitness
            age: rawUser.age ?? null,
            sex: rawUser.sex || null,
            weight_kg: rawUser.weight_kg ?? null,
            height_cm: rawUser.height_cm ?? null,
            fitness_level: rawUser.fitness_level || null,
            // Onboarding & interests
            onboarding_complete: !!rawUser.onboarding_complete,
            favorite_categories: rawUser.favorite_categories || [],
            stats: {
              trails: rawUser.completed_activities_count ?? 0,
              distance: rawUser.total_distance_km ?? 0,
              calories: Math.round(rawUser.total_calories_burned ?? 0),
              gold_badges: (rawUser.badges || []).length
            },
            badges: rawUser.badges || [],
            is_admin: rawUser.is_admin || false
          };
          set({ user: formattedUser });
        } catch (error) {
          console.error('[Auth] Failed to fetch user profile:', error);
          set({ user: null, token: null, tokenIssuedAt: null });
        }
      },

      logout: () => {
        console.log('[Auth] LOGOUT triggered. Dropping API token and user state.');
        set({ user: null, token: null, tokenIssuedAt: null });
      }
    }),
    {
      name: 'auth-storage', // unique name
    }
  )
);
