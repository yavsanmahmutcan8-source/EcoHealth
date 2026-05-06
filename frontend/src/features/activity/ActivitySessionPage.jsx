import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { BadgeUnlockToast } from '../../components/ui/BadgeUnlockToast';
import { MapContainer, TileLayer, Marker, Polyline, Popup, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useActivitySessionStore } from '../../store/activitySessionStore';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapPin, Timer, Route, Trophy, Star, ChevronUp, X, Footprints, Flag } from 'lucide-react';
import styles from './ActivitySessionPage.module.css';

// Fix leaflet marker icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ bounds }) {
  const map = useMap();
  useEffect(() => {
    if (bounds && bounds.length > 0) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [bounds, map]);
  return null;
}

function RecenterOnUser({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map]);
  return null;
}

export function ActivitySessionPage() {
  const navigate = useNavigate();
  const {
    activeActivity, sessionState, userPosition, distanceTraveled,
    elapsedSeconds, positionHistory, updatePosition, tickElapsed,
    completeActivity, abandonActivity, resetSession
  } = useActivitySessionStore();
  
  const token = useAuthStore(state => state.token);
  const fetchUser = useAuthStore(state => state.fetchUser);
  const addToast = useToastStore(state => state.addToast);

  const [completionResult, setCompletionResult] = useState(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [showBadgeToast, setShowBadgeToast] = useState(false);
  const [newBadges, setNewBadges] = useState([]);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [followUser, setFollowUser] = useState(true);
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);

  // Parse route points from the activity
  const routePoints = (() => {
    if (!activeActivity) return [];
    try {
      if (activeActivity.route_polyline) {
        return JSON.parse(activeActivity.route_polyline);
      }
    } catch (e) {}
    // Fallback: just the single lat/lng point
    if (activeActivity.latitude && activeActivity.longitude) {
      return [[activeActivity.latitude, activeActivity.longitude]];
    }
    return [];
  })();

  const startPoint = routePoints.length > 0 ? routePoints[0] : null;
  const finishPoint = routePoints.length > 1 ? routePoints[routePoints.length - 1] : startPoint;

  // Check proximity to finish point for auto-completion
  const PROXIMITY_THRESHOLD = 50; // meters
  const isNearFinish = (() => {
    if (!userPosition || !finishPoint) return false;
    const dist = getDistanceMeters(userPosition[0], userPosition[1], finishPoint[0], finishPoint[1]);
    return dist < PROXIMITY_THRESHOLD;
  })();

  // Start GPS tracking
  useEffect(() => {
    if (sessionState === 'active' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          updatePosition(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => console.warn('GPS error:', err),
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
      );
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [sessionState]);

  // Elapsed time ticker
  useEffect(() => {
    if (sessionState === 'active') {
      timerRef.current = setInterval(() => tickElapsed(), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [sessionState]);

  // Auto-complete when near finish
  useEffect(() => {
    if (isNearFinish && sessionState === 'active' && elapsedSeconds > 10) {
      handleComplete();
    }
  }, [isNearFinish, sessionState]);

  // Redirect if no active activity
  useEffect(() => {
    if (!activeActivity) {
      navigate('/explore');
    }
  }, [activeActivity, navigate]);

  const handleComplete = async () => {
    completeActivity();
    try {
      const res = await fetch(`/api/activities/${activeActivity.id}/complete`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) throw new Error('Failed to complete activity');
      const data = await res.json();
      setCompletionResult(data);
      setShowCelebration(true);
      // Show badge unlock toast if there are new badges
      if (data.newly_unlocked_badges && data.newly_unlocked_badges.length > 0) {
        setNewBadges(data.newly_unlocked_badges);
        setShowBadgeToast(true);
      }
      await fetchUser();
    } catch (err) {
      addToast(err.message || 'Error completing activity', 'error');
    }
  };

  const handleAbandon = () => {
    abandonActivity();
    addToast('Activity abandoned', 'info');
    navigate('/explore');
  };

  const handleCelebrationClose = () => {
    setShowCelebration(false);
    resetSession();
    navigate('/explore');
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters) => {
    if (meters > 1000) return `${(meters / 1000).toFixed(2)} km`;
    return `${Math.round(meters)} m`;
  };

  if (!activeActivity) return null;

  // Map bounds
  const allPoints = [...routePoints];
  if (userPosition) allPoints.push(userPosition);
  const bounds = allPoints.length > 0 ? allPoints : [[39.92077, 32.85411]];

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        {/* Header */}
        <div className={styles.sessionHeader}>
          <div>
            <h1 className="gradient-text">{activeActivity.title}</h1>
            <p className={styles.categoryBadge}>{activeActivity.category}</p>
          </div>
          <div className={styles.headerActions}>
            {sessionState === 'active' && (
              <div className={styles.livePulse}>
                <span className={styles.liveDot}></span> LIVE
              </div>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <Timer size={18} />
            <div>
              <span className={styles.statLabel}>Time</span>
              <span className={styles.statValue}>{formatTime(elapsedSeconds)}</span>
            </div>
          </div>
          <div className={styles.stat}>
            <Route size={18} />
            <div>
              <span className={styles.statLabel}>Distance</span>
              <span className={styles.statValue}>{formatDistance(distanceTraveled)}</span>
            </div>
          </div>
          <div className={styles.stat}>
            <Star size={18} />
            <div>
              <span className={styles.statLabel}>XP Reward</span>
              <span className={styles.statValue}>+{activeActivity.xp_reward || 50}</span>
            </div>
          </div>
          <div className={styles.stat}>
            <Footprints size={18} />
            <div>
              <span className={styles.statLabel}>Difficulty</span>
              <span className={styles.statValue}>{activeActivity.difficulty}/5</span>
            </div>
          </div>
        </div>

        {/* Map */}
        <div className={styles.mapContainer}>
          <MapContainer
            center={startPoint || [39.92077, 32.85411]}
            zoom={15}
            scrollWheelZoom={true}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <FitBounds bounds={bounds} />
            {followUser && userPosition && <RecenterOnUser position={userPosition} />}

            {/* Route polyline */}
            {routePoints.length > 1 && (
              <Polyline positions={routePoints} color="#4CAF50" weight={4} opacity={0.8} dashArray="10 6" />
            )}

            {/* Start marker */}
            {startPoint && (
              <Marker position={startPoint}>
                <Popup><strong>🏁 Start Point</strong></Popup>
              </Marker>
            )}

            {/* Finish marker (if different from start) */}
            {finishPoint && routePoints.length > 1 && (
              <CircleMarker center={finishPoint} radius={12} pathOptions={{ color: '#FF5722', fillColor: '#FF5722', fillOpacity: 0.7 }}>
                <Popup><strong>🎯 Finish Point</strong></Popup>
              </CircleMarker>
            )}

            {/* User position */}
            {userPosition && (
              <CircleMarker
                center={userPosition}
                radius={10}
                pathOptions={{ color: '#2196F3', fillColor: '#2196F3', fillOpacity: 0.9 }}
              >
                <Popup>📍 You are here</Popup>
              </CircleMarker>
            )}

            {/* User trail */}
            {positionHistory.length > 1 && (
              <Polyline positions={positionHistory} color="#2196F3" weight={3} opacity={0.6} />
            )}
          </MapContainer>

          {/* Map controls overlay */}
          <div className={styles.mapOverlay}>
            <button
              className={`${styles.mapBtn} ${followUser ? styles.mapBtnActive : ''}`}
              onClick={() => setFollowUser(!followUser)}
              title="Follow user location"
            >
              <MapPin size={18} />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className={styles.actions}>
          {sessionState === 'active' && (
            <>
              <Button variant="primary" onClick={handleComplete} style={{ flex: 2 }}>
                <Flag size={18} style={{ marginRight: '0.5rem' }} /> Complete Activity
              </Button>
              <Button variant="secondary" onClick={() => setShowAbandonConfirm(true)} style={{ flex: 1 }}>
                <X size={18} style={{ marginRight: '0.5rem' }} /> Abandon
              </Button>
            </>
          )}
        </div>

        {isNearFinish && sessionState === 'active' && (
          <div className={styles.proximityBanner}>
            🎯 You are near the finish point! Activity will auto-complete.
          </div>
        )}
      </main>

      {/* Abandon Confirmation Modal */}
      <Modal isOpen={showAbandonConfirm} onClose={() => setShowAbandonConfirm(false)} title="Abandon Activity?">
        <div style={{ textAlign: 'center' }}>
          <p>Are you sure you want to abandon <strong>{activeActivity.title}</strong>?</p>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>You will lose all progress for this session.</p>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <Button variant="secondary" onClick={() => setShowAbandonConfirm(false)} style={{ flex: 1 }}>Cancel</Button>
            <Button variant="primary" onClick={handleAbandon} style={{ flex: 1, background: '#f44336' }}>Abandon</Button>
          </div>
        </div>
      </Modal>

      {/* Celebration Modal */}
      <Modal isOpen={showCelebration} onClose={handleCelebrationClose} title="">
        {completionResult && (
          <div className={styles.celebration}>
            {/* Confetti particles */}
            <div className={styles.confettiContainer}>
              {[...Array(30)].map((_, i) => (
                <div key={i} className={styles.confetti} style={{
                  left: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  backgroundColor: ['#4CAF50', '#FFD700', '#FF5722', '#2196F3', '#9C27B0'][Math.floor(Math.random() * 5)]
                }} />
              ))}
            </div>

            <div className={styles.trophyBounce}>
              <Trophy size={80} color="#FFD700" />
            </div>

            <h2 className="gradient-text" style={{ fontSize: '2rem', margin: '1rem 0' }}>
              Activity Complete!
            </h2>

            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem' }}>
              Awesome work on <strong>{activeActivity.title}</strong>!
            </p>

            {/* Session Stats */}
            <div className={styles.celebrationStats}>
              <div className={styles.celebStat}>
                <Timer size={20} />
                <span>{formatTime(elapsedSeconds)}</span>
                <small>Duration</small>
              </div>
              <div className={styles.celebStat}>
                <Route size={20} />
                <span>{formatDistance(distanceTraveled)}</span>
                <small>Distance</small>
              </div>
            </div>

            {/* XP & Level */}
            <div className={styles.xpReveal}>
              <div className={styles.xpCard}>
                <Star size={24} color="#FFD700" />
                <div>
                  <span className={styles.xpAmount}>+{completionResult.new_xp - (useAuthStore.getState().user?.xp || 0) + completionResult.new_xp}</span>
                  <small>Total XP: {completionResult.new_xp}</small>
                </div>
              </div>
              <div className={styles.xpCard}>
                <ChevronUp size={24} color="#4CAF50" />
                <div>
                  <span className={styles.xpAmount}>Lv. {completionResult.new_level}</span>
                  <small>Current Level</small>
                </div>
              </div>
            </div>

            {completionResult.leveled_up && (
              <div className={styles.levelUpBanner}>
                <span className={styles.levelUpGlow}>⬆️ LEVEL UP!</span>
                <p>You reached Level {completionResult.new_level}!</p>
              </div>
            )}

            {completionResult.newly_unlocked_badges && completionResult.newly_unlocked_badges.length > 0 && (
              <div className={styles.badgesReveal}>
                <h4>🏅 New Badges Unlocked!</h4>
                {completionResult.newly_unlocked_badges.map(badge => (
                  <div key={badge.id} className={styles.badgeRevealItem}>
                    <span className={styles.badgeEmoji}>{badge.emoji || '🏅'}</span>
                    <div>
                      <strong>{badge.name}</strong>
                      <small>{badge.description}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Button variant="primary" onClick={handleCelebrationClose} style={{ width: '100%', marginTop: '1.5rem' }}>
              Continue Exploring
            </Button>
          </div>
        )}
      </Modal>

      {/* Badge unlock celebration overlay */}
      {showBadgeToast && (
        <BadgeUnlockToast 
          badges={newBadges} 
          onDismiss={() => setShowBadgeToast(false)} 
        />
      )}
    </div>
  );
}

// Haversine helper
function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
