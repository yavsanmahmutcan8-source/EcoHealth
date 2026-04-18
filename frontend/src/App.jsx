import React, { useEffect } from 'react';
import { AuthPage } from './features/auth/AuthPage';
import { ToastContainer } from './components/ui/Toast';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { useThemeStore } from './store/themeStore';

function App() {
  const initTheme = useThemeStore(state => state.initTheme);

  useEffect(() => {
    initTheme();
  }, [initTheme]);

  return (
    <>
      <ThemeToggle />
      <AuthPage />
      <ToastContainer />
    </>
  );
}

export default App;
