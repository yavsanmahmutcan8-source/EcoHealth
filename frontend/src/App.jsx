import React from 'react';
import { AuthPage } from './features/auth/AuthPage';
import { ToastContainer } from './components/ui/Toast';

function App() {
  return (
    <>
      <AuthPage />
      <ToastContainer />
    </>
  );
}

export default App;
