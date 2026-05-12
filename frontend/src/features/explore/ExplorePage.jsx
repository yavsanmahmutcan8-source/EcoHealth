import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Map, Loader, Play, Flag } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Modal } from '../../components/ui/Modal';
import { ActivityReviews } from '../../components/ui/ActivityReviews';
import { ReportModal } from '../../components/ui/ReportModal';
import { useActivitySessionStore } from '../../store/activitySessionStore';
import { useAuthStore } from '../../store/authStore';
import styles from './ExplorePage.module.css';

// Fix leaflet marker icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapEventHandler({ onBoundsChange }) {
  useMapEvents({
    moveend: (e) => {
      const center = e.target.getCenter();
      onBoundsChange(center.lat, center.lng);
    }
  });
  return null;
}

function ChangeView({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function ExplorePage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewActivity, setPreviewActivity] = useState(null);
  const [reportTarget, setReportTarget] = useState(null);
  const [mapCenter, setMapCenter] = useState([39.92077, 32.85411]);
  const { startActivity, activeActivity, sessionState } = useActivitySessionStore();
  const token = useAuthStore(s => s.token);

  // Build emoji lookup from categories
  const emojiMap = {};
  categories.forEach(c => { emojiMap[c.name] = c.emoji; });
  const getEmoji = (category) => emojiMap[category] || '📍';

  const fetchActivities = async (lat, lng) => {
    setLoading(true);
    try {
      const url = (lat && lng) ? `/api/activities?lat=${lat}&lng=${lng}&radius_km=50` : '/api/activities';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const enriched = data.map(dbActivity => ({
          ...dbActivity,
          time: dbActivity.time || '1 hr',
          loc: `Lat: ${dbActivity.latitude.toFixed(2)}, Lon: ${dbActivity.longitude.toFixed(2)}`
        }));
        setActivities(enriched);
      }
    } catch (err) {
      console.error("Failed to fetch all activities:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch categories from API
  useEffect(() => {
    fetch('/api/categories').then(r => r.ok ? r.json() : []).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    // Attempt localized user discovery on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setMapCenter([lat, lng]);
          fetchActivities(lat, lng);
        },
        () => {
          // Fallback if denied
          fetchActivities(mapCenter[0], mapCenter[1]);
        }
      );
    } else {
      fetchActivities(mapCenter[0], mapCenter[1]);
    }
  }, []);

  const handleMapPan = (lat, lng) => {
    fetchActivities(lat, lng);
  };

  const filtered = activities.filter(a => {
    const matchesSearch = a.title.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'All' || a.category === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className="gradient-text">Explore Activities</h1>
          <div className={styles.tools}>
            <div className={styles.searchBox}>
               <Search size={18} className={styles.searchIcon} />
               <input 
                 type="text" 
                 placeholder="Search trails..." 
                 value={search} 
                 onChange={e => setSearch(e.target.value)} 
                 className={styles.searchInput} 
               />
            </div>
            <select 
              className={styles.filterDropdown} 
              value={filter} 
              onChange={e => setFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.mapWrapper} style={{ height: '400px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '2rem' }}>
          <MapContainer center={mapCenter} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
            <ChangeView center={mapCenter} />
            <MapEventHandler onBoundsChange={handleMapPan} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {filtered.map(activity => (
              <Marker key={activity.id} position={[activity.latitude, activity.longitude]}>
                <Popup>
                  <strong>{activity.title}</strong><br />
                  {activity.category} - Diff {activity.difficulty}/10
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className={styles.grid}>
          {loading ? (
            <div className={styles.empty}>
              <Loader className="spin" size={32} />
            </div>
          ) : filtered.length === 0 ? (
            <p className={styles.empty}>No activities found matching your filters.</p>
          ) : (
             filtered.map(activity => {
              const routePts = (() => { try { return activity.route_polyline ? JSON.parse(activity.route_polyline) : []; } catch { return []; } })();
              return (
              <Card key={activity.id} className={styles.card} hoverable>
                <div className={styles.image} style={{ position: 'relative' }}>
                  {getEmoji(activity.category)}
                  {activity.creator_is_admin && (
                    <span style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(255, 193, 7, 0.95)', color: '#6b4f00', fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 999 }} title="Official EcoHealth Route">🏛️ Official</span>
                  )}
                </div>
                <div className={styles.content}>
                   <div className={styles.metaTop}>
                     <span className={styles.category}>{activity.category}</span>
                     <span className={styles.difficulty}>Diff {activity.difficulty}/5</span>
                   </div>
                   <h3>{activity.title}</h3>
                   {activity.creator_username && !activity.creator_is_admin && (
                     <small style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                       by{' '}
                       <button
                         type="button"
                         onClick={(e) => { e.stopPropagation(); navigate(`/profile/${activity.creator_username}`); }}
                         style={{ background: 'none', border: 'none', color: 'var(--color-primary)', padding: 0, cursor: 'pointer', font: 'inherit' }}
                       >
                         @{activity.creator_username}
                       </button>
                     </small>
                   )}
                   <div className={styles.metaBottom}>
                     <span className={styles.location}><Map size={14}/> {activity.loc}</span>
                     <span className={styles.time}>+{activity.xp_reward || 50} XP</span>
                   </div>
                   <Button
                     variant="primary"
                     style={{ marginTop: '1rem', width: '100%' }}
                     onClick={() => setPreviewActivity(activity)}
                   >
                     <Play size={16} style={{ marginRight: '0.5rem' }} /> View & Start
                   </Button>
                </div>
              </Card>
            );})
          )}
        </div>
      </main>

      {/* Activity Preview Modal */}
      <Modal isOpen={!!previewActivity} onClose={() => setPreviewActivity(null)} title={previewActivity?.title || 'Activity Details'}>
        {previewActivity && (
          <div style={{ textAlign: 'center' }}>
            {previewActivity.creator_username && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {previewActivity.creator_is_admin ? '🏛️ Official Route' : (
                  <>
                    Created by{' '}
                    <button
                      type="button"
                      onClick={() => { setPreviewActivity(null); navigate(`/profile/${previewActivity.creator_username}`); }}
                      style={{ background: 'none', border: 'none', color: 'var(--color-primary)', padding: 0, cursor: 'pointer', font: 'inherit' }}
                    >
                      @{previewActivity.creator_username}
                    </button>
                  </>
                )}
              </p>
            )}
            {/* Route preview map */}
            <div style={{ height: '250px', borderRadius: '8px', overflow: 'hidden', marginBottom: '1rem' }}>
              <MapContainer 
                center={[previewActivity.latitude, previewActivity.longitude]} 
                zoom={14} 
                scrollWheelZoom={false} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[previewActivity.latitude, previewActivity.longitude]}>
                  <Popup>🏁 Start Point</Popup>
                </Marker>
                {(() => {
                  try {
                    const pts = JSON.parse(previewActivity.route_polyline);
                    if (pts.length > 1) return <Polyline positions={pts} color="#4CAF50" weight={4} />;
                  } catch {}
                  return null;
                })()}
              </MapContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.5rem', textAlign: 'left' }}>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>Category</small>
                <p style={{ margin: 0, fontWeight: 600 }}>{previewActivity.category}</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>Difficulty</small>
                <p style={{ margin: 0, fontWeight: 600 }}>{previewActivity.difficulty}/5</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>XP Reward</small>
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--color-primary)' }}>+{previewActivity.xp_reward || 50} XP</p>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <small style={{ color: 'var(--color-text-muted)' }}>Duration</small>
                <p style={{ margin: 0, fontWeight: 600 }}>~{previewActivity.estimated_duration_minutes || 60} min</p>
              </div>
            </div>

            {activeActivity && sessionState === 'active' ? (
              <p style={{ color: '#f44336', fontSize: '0.875rem', marginBottom: '1rem' }}>
                ⚠️ You already have an active activity. Complete or abandon it first.
              </p>
            ) : (
              <Button
                variant="primary"
                style={{ width: '100%' }}
                onClick={() => {
                  startActivity(previewActivity);
                  setPreviewActivity(null);
                  navigate('/activity');
                }}
              >
                <Play size={18} style={{ marginRight: '0.5rem' }} /> Start Activity
              </Button>
            )}

            {token && (
              <button
                type="button"
                onClick={() => setReportTarget({ kind: 'activity', id: previewActivity.id, label: previewActivity.title })}
                style={{ marginTop: '0.75rem', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Flag size={13} /> Report this activity
              </button>
            )}

            {/* Reviews section */}
            <ActivityReviews activityId={previewActivity.id} />
          </div>
        )}
      </Modal>

      <ReportModal
        isOpen={!!reportTarget}
        onClose={() => setReportTarget(null)}
        target={reportTarget}
      />
    </div>
  );
}
