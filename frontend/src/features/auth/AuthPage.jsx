import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  
  // Controlled inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const addToast = useToastStore(state => state.addToast);
  const login = useAuthStore(state => state.login);
  const register = useAuthStore(state => state.register);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulating API lag
    setTimeout(() => {
      setIsLoading(false);
      try {
        if (isLogin) {
          login(email, password);
          addToast("Successfully logged in!", "success");
        } else {
          register(name, email);
          addToast("Account created successfully!", "success");
        }
      } catch (err) {
        addToast("Failed to authenticate.", "error");
      }
    }, 1000);
  };

  const handleGoogleLogin = () => {
    // Treat Google Login as a new basic user login for UI demonstration
    login(email || 'google_user', 'placeholder');
    addToast("Logged in via Google provider!", "success");
  };

  return (
    <>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>
      <div className={styles.authContainer}>
      <Card className={styles.authCard}>
        <div className={styles.header}>
          <h1 className="gradient-text">{isLogin ? 'Welcome Back' : 'Join EcoHealth'}</h1>
          <p>{isLogin ? 'Sign in to track your nature adventures.' : 'Start your health and nature journey today.'}</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {!isLogin && (
            <Input 
              label="Full Name" 
              placeholder="John Doe" 
              value={name}
              onChange={e => setName(e.target.value)}
              required 
            />
          )}
          <Input 
            label="Email Address (Try 'testuser')" 
            type="text" 
            placeholder="eco@example.com" 
            value={email}
            onChange={e => setEmail(e.target.value)}
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••" 
            value={password}
            onChange={e => setPassword(e.target.value)}
            required 
          />
          
          <Button type="submit" variant="primary" isLoading={isLoading} style={{ marginTop: '1rem' }}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className={styles.divider}>or</div>

        <Button type="button" variant="secondary" onClick={handleGoogleLogin}>
          <svg className={styles.googleIcon} viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </Button>

        <div className={styles.toggleAction}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button type="button" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </Card>
    </div>
    </>
  );
}
