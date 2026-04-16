import React, { useState } from 'react';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../store/toastStore';
import styles from './AuthPage.module.css';

export function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const addToast = useToastStore(state => state.addToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Mocking an API call
    setTimeout(() => {
      setIsLoading(false);
      addToast(isLogin ? "Successfully logged in!" : "Account created successfully!", "success");
    }, 1500);
  };

  return (
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
              required 
            />
          )}
          <Input 
            label="Email Address" 
            type="email" 
            placeholder="eco@example.com" 
            required 
          />
          <Input 
            label="Password" 
            type="password" 
            placeholder="••••••••" 
            required 
          />
          
          <Button type="submit" variant="primary" isLoading={isLoading} style={{ marginTop: '1rem' }}>
            {isLogin ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className={styles.toggleAction}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
          <button type="button" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign Up' : 'Log In'}
          </button>
        </div>
      </Card>
    </div>
  );
}
