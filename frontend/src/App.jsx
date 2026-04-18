import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ExplorePage } from './features/explore/ExplorePage';
import { ProfilePage } from './features/profile/ProfilePage';
import { ToastContainer } from './components/ui/Toast';
import { ThemeToggle } from './components/ui/ThemeToggle';
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
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/auth" />} />
        <Route path="/explore" element={user ? <ExplorePage /> : <Navigate to="/auth" />} />
        <Route path="/profile" element={user ? <ProfilePage /> : <Navigate to="/auth" />} />
        
        {/* Redirect root to auth ALWAYS */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
