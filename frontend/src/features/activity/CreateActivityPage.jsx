import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, MapPin } from 'lucide-react';
import styles from './CreateActivityPage.module.css';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function RouteBuilderMap({ points, setPoints }) {
  useMapEvents({
    click(e) {
      setPoints([...points, [e.latlng.lat, e.latlng.lng]]);
    }
  });

  return (
    <>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {points.length > 0 && <Marker position={points[0]} />}
      {points.length > 1 && <Polyline positions={points} color="#4CAF50" weight={4} />}
    </>
  );
}

export function CreateActivityPage() {
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const user = useAuthStore(state => state.user);
  const addToast = useToastStore(state => state.addToast);

  const [categories, setCategories] = useState([]);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState(3);
  const [xpReward, setXpReward] = useState(50);
  const [duration, setDuration] = useState(60);
  const [distanceKm, setDistanceKm] = useState(0);
  const [routePoints, setRoutePoints] = useState([]);
  const [mapCenter, setMapCenter] = useState([39.92077, 32.85411]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setCategories(data);
        if (data.length > 0) setCategory(data[0].name);
      })
      .catch(() => {});

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setMapCenter([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

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
      const res = await fetch('/api/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          category,
          difficulty: parseInt(difficulty, 10),
          latitude: routePoints[0][0],
          longitude: routePoints[0][1],
          xp_reward: parseInt(xpReward, 10),
          estimated_duration_minutes: parseInt(duration, 10),
          distance_km: parseFloat(distanceKm) || 0,
          route_polyline: JSON.stringify(routePoints),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create activity');
      }

      // Backend forces draft state for non-admin submissions
      if (user?.is_admin) {
        addToast('Activity published! 🎉', 'success');
      } else {
        addToast('Submitted for admin review. You will see it published once approved.', 'success');
      }
      navigate('/explore');
    } catch (err) {
      addToast(err.message || 'Could not create activity.', 'error');
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
          <h1 className="gradient-text">Design a Route</h1>
          <p>Share a trail, park loop, or adventure with the EcoHealth community. You'll earn XP every time someone completes it!</p>
        </div>

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
                label="Est. Duration (mins)"
                type="number"
                min="5"
                max="600"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                required
              />
            </div>

            <Input
              label="Distance (km)"
              type="number"
              min="0"
              step="0.1"
              value={distanceKm}
              onChange={e => setDistanceKm(e.target.value)}
              placeholder="e.g. 3.5"
            />

            <div className={styles.field}>
              <label>
                <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Tap the map to draw your route
              </label>
              <div className={styles.mapBox}>
                <MapContainer center={mapCenter} zoom={13} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                  <RouteBuilderMap points={routePoints} setPoints={setRoutePoints} />
                </MapContainer>
              </div>
              <div className={styles.mapHint}>
                <small>{routePoints.length} {routePoints.length === 1 ? 'point' : 'points'} placed</small>
                <button
                  type="button"
                  onClick={() => setRoutePoints([])}
                  className={styles.clearBtn}
                >
                  Clear Map
                </button>
              </div>
            </div>

            {!user?.is_admin && (
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
                ℹ️ Routes submitted by community members are reviewed by an admin before going live.
              </p>
            )}
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              {user?.is_admin ? 'Publish Activity' : 'Submit for Review'}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
