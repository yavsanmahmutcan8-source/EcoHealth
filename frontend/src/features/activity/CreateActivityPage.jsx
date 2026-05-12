import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { MapSearchBar } from '../../components/ui/MapSearchBar';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, MapPin, Undo2, Redo2 } from 'lucide-react';
import { polylineDistanceKm } from '../../utils/geo';
import styles from './CreateActivityPage.module.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function RouteClicker({ onAdd }) {
  useMapEvents({
    click(e) { onAdd([e.latlng.lat, e.latlng.lng]); }
  });
  return null;
}

function MapFlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo(target, 15, { duration: 0.8 });
  }, [target, map]);
  return null;
}

export function CreateActivityPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = !!editId;
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const addToast = useToastStore(state => state.addToast);

  const [categories, setCategories] = useState([]);
  const [feedbackEntries, setFeedbackEntries] = useState([]);
  const [submissionStatus, setSubmissionStatus] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [xpReward, setXpReward] = useState(50);
  const [duration, setDuration] = useState(60);
  const [isLoop, setIsLoop] = useState(false);
  const [lapCount, setLapCount] = useState(1);

  // Route drawing with undo/redo history
  const [routePoints, setRoutePoints] = useState([]);
  const [undoStack, setUndoStack] = useState([]);  // each entry is a previous points array
  const [redoStack, setRedoStack] = useState([]);

  const [mapCenter, setMapCenter] = useState([39.92077, 32.85411]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find selected category object to read requires_distance
  const selectedCategory = useMemo(
    () => categories.find(c => c.name === category) || null,
    [categories, category]
  );
  const requiresDistance = selectedCategory ? !!selectedCategory.requires_distance : true;

  // Auto-computed distance from the drawn route
  const computedDistanceKm = useMemo(
    () => polylineDistanceKm(routePoints, isLoop),
    [routePoints, isLoop]
  );
  const effectiveDistanceKm = useMemo(
    () => computedDistanceKm * (isLoop ? Math.max(1, parseInt(lapCount, 10) || 1) : 1),
    [computedDistanceKm, isLoop, lapCount]
  );

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setCategories(data);
        if (!isEditMode && data.length > 0) setCategory(data[0].name);
      })
      .catch(() => {});

    if (!isEditMode && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, [isEditMode]);

  // Edit mode: prefill from existing activity + load admin feedback
  useEffect(() => {
    if (!isEditMode || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/activities/${editId}`);
        if (!res.ok) throw new Error('Could not load activity');
        const a = await res.json();
        if (cancelled) return;
        setTitle(a.title || '');
        setCategory(a.category || '');
        setDifficulty(a.difficulty || 3);
        setXpReward(a.xp_reward || 50);
        setDuration(a.estimated_duration_minutes || 60);
        setIsLoop(!!a.is_loop);
        setLapCount(a.lap_count || 1);
        setSubmissionStatus(a.submission_status || null);
        let pts = [];
        try { pts = a.route_polyline ? JSON.parse(a.route_polyline) : []; } catch { pts = []; }
        setRoutePoints(pts);
        if (pts.length > 0) setMapCenter(pts[0]);
      } catch (err) {
        addToast(err.message || 'Failed to load activity for edit', 'error');
        navigate('/profile');
      }
    })();
    // Load admin feedback history
    fetch(`/api/activities/${editId}/feedback`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(d => { if (!cancelled) setFeedbackEntries(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isEditMode, editId, token, addToast, navigate]);

  // When category changes to a non-distance one, reset loop/lap to defaults
  useEffect(() => {
    if (!requiresDistance) {
      setIsLoop(false);
      setLapCount(1);
    }
  }, [requiresDistance]);

  const pushPoint = (pt) => {
    setUndoStack(stack => [...stack, routePoints]);
    setRedoStack([]);
    setRoutePoints(pts => [...pts, pt]);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(stack => stack.slice(0, -1));
    setRedoStack(stack => [routePoints, ...stack]);
    setRoutePoints(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setRedoStack(stack => stack.slice(1));
    setUndoStack(stack => [...stack, routePoints]);
    setRoutePoints(next);
  };

  const handleClear = () => {
    if (routePoints.length === 0) return;
    setUndoStack(stack => [...stack, routePoints]);
    setRedoStack([]);
    setRoutePoints([]);
  };

  const handleSearchSelect = (lat, lng) => {
    setFlyTarget([lat, lng]);
  };

  // Loop visualisation: append first point at end so polyline closes
  const displayPolyline = isLoop && routePoints.length > 1
    ? [...routePoints, routePoints[0]]
    : routePoints;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (routePoints.length === 0) {
      addToast('Click on the map to place at least a starting point.', 'error');
      return;
    }
    if (!title.trim()) {
      addToast('Please give your activity a title.', 'error');
      return;
    }
    if (!category) {
      addToast('Please select a category.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: title.trim(),
        category,
        difficulty: parseInt(difficulty, 10),
        latitude: routePoints[0][0],
        longitude: routePoints[0][1],
        xp_reward: parseInt(xpReward, 10),
        estimated_duration_minutes: parseInt(duration, 10),
        distance_km: requiresDistance ? Number(computedDistanceKm.toFixed(3)) : 0,
        is_loop: requiresDistance ? isLoop : false,
        lap_count: requiresDistance && isLoop ? Math.max(1, parseInt(lapCount, 10) || 1) : 1,
        route_polyline: JSON.stringify(routePoints),
      };
      const url = isEditMode ? `/api/activities/${editId}` : '/api/activities';
      const method = isEditMode ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || (isEditMode ? 'Failed to update activity' : 'Failed to create activity'));
      }

      if (isEditMode) {
        addToast(user?.is_admin ? 'Activity updated 🎉' : 'Resubmitted for admin review.', 'success');
        navigate('/profile');
      } else if (user?.is_admin) {
        addToast('Activity published! 🎉', 'success');
        navigate('/explore');
      } else {
        addToast('Submitted for admin review. You will see it published once approved.', 'success');
        navigate('/explore');
      }
    } catch (err) {
      addToast(err.message || 'Could not save activity.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  return (
    <div className={styles.container}>
      <Navbar />
      <main className={styles.main}>
        <button onClick={() => navigate(-1)} className={styles.backBtn}>
          <ArrowLeft size={16} /> Back
        </button>

        <div className={styles.header}>
          <h1 className="gradient-text">{isEditMode ? 'Edit Route' : 'Design a Route'}</h1>
          <p>
            {isEditMode
              ? 'Update your route and resubmit it for admin review.'
              : "Share a trail, park loop, or adventure with the EcoHealth community. You'll earn XP every time someone completes it!"}
          </p>
        </div>

        {isEditMode && submissionStatus === 'changes_requested' && feedbackEntries.length > 0 && (
          <Card style={{ marginBottom: '1rem', background: 'rgba(255,193,7,0.10)', border: '1px solid rgba(255,193,7,0.4)' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--color-text)' }}>📝 Admin requested changes</h3>
            <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Address the feedback below, then save to resubmit.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.5rem' }}>
              {feedbackEntries.map(fb => (
                <li key={fb.id} style={{ padding: '0.6rem 0.75rem', background: 'var(--glass-bg)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    {fb.admin_username ? `@${fb.admin_username}` : 'Admin'} · {fb.created_at ? new Date(fb.created_at).toLocaleString() : ''}
                  </div>
                  <div style={{ fontSize: '0.9rem', whiteSpace: 'pre-wrap' }}>{fb.message}</div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card className={styles.formCard}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <Input
              label="Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Sunset Loop at Eymir Lake"
              required
            />

            <div className={styles.grid2}>
              <div className={styles.field}>
                <label>Category</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className={styles.select}
                  required
                >
                  {categories.length === 0 && <option value="">Loading...</option>}
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
                  ))}
                </select>
                {selectedCategory && !requiresDistance && (
                  <small style={{ color: 'var(--color-text-muted)' }}>
                    ℹ️ This activity doesn't track distance — calories are calculated from your session time.
                  </small>
                )}
              </div>

              <div className={styles.field}>
                <label>Difficulty (1-5)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={difficulty}
                  onChange={e => setDifficulty(e.target.value)}
                  className={styles.select}
                  required
                />
              </div>
            </div>

            <div className={styles.grid2}>
              <Input
                label="XP Reward"
                type="number"
                min="10"
                max="500"
                value={xpReward}
                onChange={e => setXpReward(e.target.value)}
                required
              />
              <Input
                label="Est. Duration (mins, per lap if loop)"
                type="number"
                min="5"
                max="600"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                required
              />
            </div>

            {requiresDistance && (
              <div className={styles.field}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isLoop}
                    onChange={(e) => setIsLoop(e.target.checked)}
                    style={{ width: 16, height: 16 }}
                  />
                  Connect start and end points (loop route)
                </label>
                {isLoop && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label>Laps</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={lapCount}
                      onChange={(e) => setLapCount(e.target.value)}
                      className={styles.select}
                    />
                    <small style={{ color: 'var(--color-text-muted)' }}>
                      One lap is {computedDistanceKm.toFixed(2)} km, total {effectiveDistanceKm.toFixed(2)} km.
                    </small>
                  </div>
                )}
              </div>
            )}

            <div className={styles.field}>
              <label>
                <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Search a location, then tap the map to draw your route
              </label>

              <div style={{ position: 'relative' }}>
                <div className={styles.mapBox}>
                  <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <MapFlyTo target={flyTarget} />
                    <RouteClicker onAdd={pushPoint} />
                    {routePoints.length > 0 && <Marker position={routePoints[0]} />}
                    {displayPolyline.length > 1 && (
                      <Polyline positions={displayPolyline} color={isLoop ? '#1976d2' : '#4CAF50'} weight={4} />
                    )}
                  </MapContainer>
                </div>
                <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 1100 }}>
                  <MapSearchBar onSelect={handleSearchSelect} placeholder="Search city, park, address…" />
                </div>
              </div>

              <div className={styles.mapHint}>
                <small>
                  {routePoints.length} {routePoints.length === 1 ? 'point' : 'points'} placed
                  {requiresDistance && routePoints.length > 1 && (
                    <> · ≈ {computedDistanceKm.toFixed(2)} km{isLoop && lapCount > 1 ? ` × ${lapCount} laps = ${effectiveDistanceKm.toFixed(2)} km` : ''}</>
                  )}
                </small>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    type="button"
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    className={styles.clearBtn}
                    title="Undo last point"
                    style={{ opacity: undoStack.length === 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Undo2 size={14} /> Undo
                  </button>
                  <button
                    type="button"
                    onClick={handleRedo}
                    disabled={redoStack.length === 0}
                    className={styles.clearBtn}
                    title="Redo"
                    style={{ opacity: redoStack.length === 0 ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <Redo2 size={14} /> Redo
                  </button>
                  <button
                    type="button"
                    onClick={handleClear}
                    className={styles.clearBtn}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {!user?.is_admin && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                ℹ️ Routes submitted by community members are reviewed by an admin before going live.
              </p>
            )}
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {isEditMode
                ? (user?.is_admin ? 'Save Changes' : 'Save & Resubmit for Review')
                : (user?.is_admin ? 'Publish Activity' : 'Submit for Review')}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
