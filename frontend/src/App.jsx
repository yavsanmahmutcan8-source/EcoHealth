import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthPage } from './features/auth/AuthPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { ExplorePage } from './features/explore/ExplorePage';
import { ToastContainer } from './components/ui/Toast';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { useThemeStore } from './store/themeStore';
import { useAuthStore } from './store/authStore';
import { useEffect } from 'react';

function App() {
  const initTheme = useThemeStore(state => state.initTheme);
  const user = useAuthStore(state => state.user);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/dashboard" />} />
        <Route path="/dashboard" element={user ? <DashboardPage /> : <Navigate to="/auth" />} />
        <Route path="/explore" element={user ? <ExplorePage /> : <Navigate to="/auth" />} />
        
        {/* Redirect root to auth ALWAYS */}
        <Route path="/" element={<Navigate to="/auth" replace />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}

export default App;
