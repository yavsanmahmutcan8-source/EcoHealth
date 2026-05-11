import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import { ThemeToggle } from '../../components/ui/ThemeToggle';
import styles from './AuthPage.module.css';

const FITNESS_LEVELS = [
  { id: 'beginner', label: 'Beginner', emoji: '🌱', desc: 'New to active life' },
  { id: 'intermediate', label: 'Intermediate', emoji: '🚶', desc: 'Active a few times a week' },
  { id: 'advanced', label: 'Advanced', emoji: '🏃', desc: 'Train regularly' },
  { id: 'athlete', label: 'Athlete', emoji: '🏆', desc: 'Compete or push limits' },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState('about_you'); // 'about_you' | 'interests'
  const [isLoading, setIsLoading] = useState(false);

  const [age, setAge] = useState('');
  const [sex, setSex] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [fitnessLevel, setFitnessLevel] = useState('');
  const [interests, setInterests] = useState([]);
  const [categories, setCategories] = useState([]);

  const addToast = useToastStore(state => state.addToast);
  const updateProfile = useAuthStore(state => state.updateProfile);
  const updateInterests = useAuthStore(state => state.updateInterests);
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);

  const handleEscapeLogout = () => {
    logout();
    navigate('/auth', { replace: true });
  };

  useEffect(() => {
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then(setCategories).catch(() => {});
  }, []);

  // Pre-fill from existing user (if any)
  useEffect(() => {
    if (!user) return;
    if (user.age) setAge(String(user.age));
    if (user.sex) setSex(user.sex);
    if (user.weight_kg) setWeight(String(user.weight_kg));
    if (user.height_cm) setHeight(String(user.height_cm));
    if (user.fitness_level) setFitnessLevel(user.fitness_level);
    if (Array.isArray(user.favorite_categories)) setInterests(user.favorite_categories);
  }, [user]);

  const finishOnboarding = () => {
    addToast('Welcome to EcoHealth! 🌿', 'success');
    navigate('/dashboard', { replace: true });
  };

  const handleSaveAboutYou = async (skip = false) => {
    setIsLoading(true);
    try {
      if (!skip) {
        const payload = {};
        if (age) payload.age = parseInt(age, 10);
        if (sex) payload.sex = sex;
        if (weight) payload.weight_kg = parseFloat(weight);
        if (height) payload.height_cm = parseFloat(height);
        if (fitnessLevel) payload.fitness_level = fitnessLevel;
        if (Object.keys(payload).length > 0) {
          await updateProfile(payload);
        }
      }
      setStep('interests');
    } catch (err) {
      addToast(err.message || 'Could not save fitness profile.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveInterests = async (skip = false) => {
    setIsLoading(true);
    try {
      await updateInterests(skip ? [] : interests);
      finishOnboarding();
    } catch (err) {
      addToast(err.message || 'Could not save your interests.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleInterest = (cat) => {
    setInterests(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
  };

  if (step === 'about_you') {
    return (
      <>
        <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleEscapeLogout}
            style={{
              background: 'rgba(0,0,0,0.04)', border: '1px solid var(--glass-border)',
              borderRadius: '8px', padding: '0.4rem 0.75rem',
              color: 'var(--color-text-muted)', cursor: 'pointer',
              fontSize: '0.78rem', fontWeight: 600,
            }}
            title="Sign out and return to login"
          >
            Log out
          </button>
          <ThemeToggle />
        </div>
        <div className={styles.authContainer}>
          <Card className={styles.authCard}>
            <div className={styles.header}>
              <h1 className="gradient-text">A bit about you</h1>
              <p>Step 1 of 2 — helps us match you to the right activities. Optional.</p>
            </div>

            <div className={styles.form}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input label="Age" type="number" min="10" max="120" value={age} onChange={e => setAge(e.target.value)} placeholder="28" />
                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Sex</label>
                  <select
                    value={sex}
                    onChange={e => setSex(e.target.value)}
                    style={{
                      width: '100%', padding: '0.7rem 0.85rem', borderRadius: '8px',
                      border: '1px solid var(--glass-border)', background: 'var(--glass-bg)',
                      color: 'var(--color-text)', fontSize: '0.95rem'
                    }}
                  >
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <Input label="Weight (kg)" type="number" step="0.1" min="20" max="300" value={weight} onChange={e => setWeight(e.target.value)} placeholder="70" />
                <Input label="Height (cm)" type="number" min="80" max="250" value={height} onChange={e => setHeight(e.target.value)} placeholder="175" />
              </div>

              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', display: 'block' }}>Fitness level</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  {FITNESS_LEVELS.map(lvl => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setFitnessLevel(lvl.id)}
                      style={{
                        padding: '0.65rem',
                        borderRadius: '10px',
                        border: fitnessLevel === lvl.id ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                        background: fitnessLevel === lvl.id ? 'rgba(76, 175, 80, 0.12)' : 'var(--glass-bg)',
                        color: 'var(--color-text)',
                        textAlign: 'left',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ fontSize: '1.1rem' }}>{lvl.emoji} <strong>{lvl.label}</strong></div>
                      <small style={{ color: 'var(--color-text-muted)' }}>{lvl.desc}</small>
                    </button>
                  ))}
                </div>
              </div>

              <Button variant="primary" onClick={() => handleSaveAboutYou(false)} isLoading={isLoading}>
                Continue
              </Button>
              <button
                type="button"
                onClick={() => handleSaveAboutYou(true)}
                disabled={isLoading}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Skip for now
              </button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  // step === 'interests'
  return (
    <>
      <div style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', zIndex: 50 }}>
        <ThemeToggle />
      </div>
      <div className={styles.authContainer}>
        <Card className={styles.authCard} style={{ maxWidth: 540 }}>
          <div className={styles.header}>
            <h1 className="gradient-text">What excites you?</h1>
            <p>Step 2 of 2 — pick the activities you'd love to try. We'll prioritise them.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '0.55rem' }}>
            {categories.length === 0 && (
              <div style={{ gridColumn: '1 / -1', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1rem' }}>
                Loading categories...
              </div>
            )}
            {categories.map(cat => {
              const selected = interests.includes(cat.name);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleInterest(cat.name)}
                  style={{
                    padding: '0.85rem 0.5rem',
                    borderRadius: '12px',
                    border: selected ? `2px solid ${cat.color || 'var(--color-primary)'}` : '1px solid var(--glass-border)',
                    background: selected ? `${cat.color || '#4CAF50'}22` : 'var(--glass-bg)',
                    color: 'var(--color-text)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <div style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>{cat.emoji}</div>
                  {cat.name}
                </button>
              );
            })}
          </div>

          <Button variant="primary" onClick={() => handleSaveInterests(false)} isLoading={isLoading} disabled={interests.length === 0}>
            Save & finish ({interests.length})
          </Button>
          <button
            type="button"
            onClick={() => handleSaveInterests(true)}
            disabled={isLoading}
            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.85rem' }}
          >
            Skip for now
          </button>
        </Card>
      </div>
    </>
  );
}
