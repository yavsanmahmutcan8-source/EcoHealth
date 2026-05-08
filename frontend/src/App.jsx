import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { OnboardingPage } from './features/auth/OnboardingPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ExplorePage } from './features/explore/ExplorePage';
import { ProfilePage } from './features/profile/ProfilePage';
import { PublicProfilePage } from './features/profile/PublicProfilePage';
import { AdminPage } from './features/admin/AdminPage';
import { ActivitySessionPage } from './features/activity/ActivitySessionPage';
import { CreateActivityPage } from './features/activity/CreateActivityPage';
import { FloatingActivityButton } from './components/layout/FloatingActivityButton';
import { ToastContainer } from './components/ui/Toast';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';

// Helper component to track route changes
function AppLog() {
  const location = useLocation();
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    console.log(`[Router] Navigate to: ${location.pathname} | User logged in: ${!!user}`);
  }, [location, user]);
  return null;
}

function HomeRedirect() {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/auth" replace />;
  if (!user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}

function RequireAuth({ children, requireOnboarded = true }) {
  const user = useAuthStore(state => state.user);
  if (!user) return <Navigate to="/auth" replace />;
  if (requireOnboarded && !user.onboarding_complete) return <Navigate to="/onboarding" replace />;
  return children;
}

function App() {
  const initTheme = useThemeStore(state => state.initTheme);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    console.log('[App] Mounted. Current user state:', user);
    initTheme();
  }, [initTheme, user]);

  return (
    <BrowserRouter>
      <AppLog />
      <Routes>
        <Route path="/auth" element={!user ? <AuthPage /> : <HomeRedirect />} />
        <Route path="/onboarding" element={user ? <OnboardingPage /> : <Navigate to="/auth" />} />

        <Route path="/dashboard" element={<RequireAuth><DashboardPage /></RequireAuth>} />
        <Route path="/explore" element={<RequireAuth><ExplorePage /></RequireAuth>} />
        <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
        <Route path="/profile/:username" element={<RequireAuth><PublicProfilePage /></RequireAuth>} />
        <Route path="/create" element={<RequireAuth><CreateActivityPage /></RequireAuth>} />
        <Route path="/admin" element={user?.is_admin ? <AdminPage /> : <Navigate to="/dashboard" />} />
        <Route path="/activity" element={<RequireAuth><ActivitySessionPage /></RequireAuth>} />

        <Route path="/" element={<HomeRedirect />} />
      </Routes>
      {user && <FloatingActivityButton />}
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
