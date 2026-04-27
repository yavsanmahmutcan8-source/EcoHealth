import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useActivitySessionStore = create(
  persist(
    (set, get) => ({
      // The activity object currently being tracked
      activeActivity: null,
      // Session state: 'idle' | 'active' | 'completed' | 'abandoned'
      sessionState: 'idle',
      // Timestamp when user started the activity
      startedAt: null,
      // User's live coordinates [lat, lng]
      userPosition: null,
      // Distance traveled in meters
      distanceTraveled: 0,
      // Elapsed seconds
      elapsedSeconds: 0,
      // Position history for drawing the user's path
      positionHistory: [],

      startActivity: (activity) => {
        set({
          activeActivity: activity,
          sessionState: 'active',
          startedAt: Date.now(),
          userPosition: null,
          distanceTraveled: 0,
          elapsedSeconds: 0,
          positionHistory: [],
        });
      },

      updatePosition: (lat, lng) => {
        const state = get();
        const newPos = [lat, lng];
        const history = [...state.positionHistory, newPos];
        
        // Calculate distance from last known position
        let addedDistance = 0;
        if (state.userPosition) {
          addedDistance = getDistanceMeters(
            state.userPosition[0], state.userPosition[1],
            lat, lng
          );
        }

        set({
          userPosition: newPos,
          positionHistory: history,
          distanceTraveled: state.distanceTraveled + addedDistance,
        });
      },

      tickElapsed: () => {
        const state = get();
        if (state.sessionState === 'active' && state.startedAt) {
          set({ elapsedSeconds: Math.floor((Date.now() - state.startedAt) / 1000) });
        }
      },

      completeActivity: () => {
        set({ sessionState: 'completed' });
      },

      abandonActivity: () => {
        set({
          activeActivity: null,
          sessionState: 'idle',
          startedAt: null,
          userPosition: null,
          distanceTraveled: 0,
          elapsedSeconds: 0,
          positionHistory: [],
        });
      },

      resetSession: () => {
        set({
          activeActivity: null,
          sessionState: 'idle',
          startedAt: null,
          userPosition: null,
          distanceTraveled: 0,
          elapsedSeconds: 0,
          positionHistory: [],
        });
      },

      isActive: () => get().sessionState === 'active',
    }),
    {
      name: 'activity-session-storage',
    }
  )
);

// Haversine distance formula
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}
