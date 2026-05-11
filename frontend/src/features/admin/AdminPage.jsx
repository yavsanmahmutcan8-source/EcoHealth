import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, Edit3, Plus, Undo2, Redo2 } from 'lucide-react';
import { MapSearchBar } from '../../components/ui/MapSearchBar';
import { polylineDistanceKm } from '../../utils/geo';
import styles from './AdminPage.module.css';

// Fix leaflet marker icon paths
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

export function AdminPage() {
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const addToast = useToastStore(state => state.addToast);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users', 'activities', 'create', 'categories'
  
  // Activity form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState(1);
  const [xpReward, setXpReward] = useState(50);
  const [duration, setDuration] = useState(60);
  const [isLoop, setIsLoop] = useState(false);
  const [lapCount, setLapCount] = useState(1);
  const [routePoints, setRoutePoints] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [flyTarget, setFlyTarget] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📍');
  const [newCatColor, setNewCatColor] = useState('#4CAF50');
  const [newCatMet, setNewCatMet] = useState(4.0);
  const [newCatRequiresDistance, setNewCatRequiresDistance] = useState(true);
  const [editingCat, setEditingCat] = useState(null);

  // Selected category metadata for the route builder
  const selectedCategory = useMemo(
    () => categories.find(c => c.name === category) || null,
    [categories, category]
  );
  const requiresDistance = selectedCategory ? !!selectedCategory.requires_distance : true;

  const computedDistanceKm = useMemo(
    () => polylineDistanceKm(routePoints, isLoop),
    [routePoints, isLoop]
  );
  const effectiveDistanceKm = useMemo(
    () => computedDistanceKm * (isLoop ? Math.max(1, parseInt(lapCount, 10) || 1) : 1),
    [computedDistanceKm, isLoop, lapCount]
  );

  // Reset loop/lap when category is non-distance
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
  const handleClearRoute = () => {
    if (routePoints.length === 0) return;
    setUndoStack(stack => [...stack, routePoints]);
    setRedoStack([]);
    setRoutePoints([]);
  };

  const displayPolyline = isLoop && routePoints.length > 1
    ? [...routePoints, routePoints[0]]
    : routePoints;

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchActivities = async () => {
    try {
      // Admin endpoint returns ALL activities (drafts + published)
      const res = await fetch('/api/admin/activities', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const setActivityVisibility = async (id, state) => {
    try {
      const res = await fetch(`/api/admin/activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visibility_state: state })
      });
      if (!res.ok) throw new Error('Failed');
      addToast(state === 'publish' ? 'Activity approved & published' : 'Activity moved to draft', 'success');
      fetchActivities();
    } catch {
      addToast('Failed to update activity', 'error');
    }
  };

  const deleteActivity = async (id) => {
    if (!confirm('Delete this activity permanently?')) return;
    try {
      const res = await fetch(`/api/admin/activities/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed');
      addToast('Activity deleted', 'info');
      fetchActivities();
    } catch {
      addToast('Failed to delete activity', 'error');
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        if (data.length > 0 && !category) setCategory(data[0].name);
      }
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
    fetchActivities();
    fetchCategories();
  }, [token]);

  const handleBulkPublish = async (state) => {
    // Demo implementation for bulk publish
    addToast(`Bulk update to '${state}' is not yet implemented in backend, but UI is ready!`, 'success');
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();
    if (routePoints.length === 0) {
      addToast("Please click on the map to define the starting location.", "error");
      return;
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/activities', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title,
          category,
          difficulty: parseInt(difficulty),
          latitude: routePoints[0][0],
          longitude: routePoints[0][1],
          xp_reward: parseInt(xpReward),
          estimated_duration_minutes: parseInt(duration),
          distance_km: requiresDistance ? Number(computedDistanceKm.toFixed(3)) : 0,
          is_loop: requiresDistance ? isLoop : false,
          lap_count: requiresDistance && isLoop ? Math.max(1, parseInt(lapCount, 10) || 1) : 1,
          route_polyline: JSON.stringify(routePoints),
          visibility_state: 'publish'
        })
      });
      
      if (res.ok) {
        addToast("Activity created successfully!", "success");
        setTitle('');
        setRoutePoints([]);
        setUndoStack([]);
        setRedoStack([]);
        setIsLoop(false);
        setLapCount(1);
        fetchActivities();
        setActiveTab('activities');
      } else {
        const data = await res.json();
        addToast(data.detail || "Failed to create activity", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network error", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main className={styles.adminContainer} style={{ flex: 1, width: '100%' }}>
        <div className={styles.header}>
          <h1 className="gradient-text">Admin Portal</h1>
          <p>Manage users and create new activities</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Button variant={activeTab === 'users' ? 'primary' : 'secondary'} onClick={() => setActiveTab('users')}>Users</Button>
          <Button variant={activeTab === 'activities' ? 'primary' : 'secondary'} onClick={() => setActiveTab('activities')}>Activities</Button>
          <Button variant={activeTab === 'create' ? 'primary' : 'secondary'} onClick={() => setActiveTab('create')}>Route Builder</Button>
          <Button variant={activeTab === 'categories' ? 'primary' : 'secondary'} onClick={() => setActiveTab('categories')}>Categories</Button>
        </div>

        {activeTab === 'users' && (
          <Card className={styles.card}>
            <h2>User Management</h2>
            {loading ? <p>Loading users...</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th><th>Username</th><th>Email</th><th>Role</th>
                      <th>Lvl</th><th>XP</th>
                      <th>Age</th><th>Sex</th><th>Weight (kg)</th><th>Height (cm)</th><th>Fitness</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>
                          <button
                            type="button"
                            onClick={() => navigate(`/profile/${u.username}`)}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                          >
                            {u.username}
                          </button>
                        </td>
                        <td>{u.email}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '12px', background: u.is_admin ? '#4CAF50' : '#e0e0e0', color: u.is_admin ? '#fff' : '#333', fontSize: '0.8rem', fontWeight: u.is_admin ? 'bold' : 'normal' }}>{u.is_admin ? 'Admin' : 'User'}</span></td>
                        <td>{u.level}</td>
                        <td>{u.xp}</td>
                        <td>{u.age ?? '—'}</td>
                        <td>{u.sex || '—'}</td>
                        <td>{u.weight_kg ?? '—'}</td>
                        <td>{u.height_cm ?? '—'}</td>
                        <td>{u.fitness_level || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'activities' && (
          <Card className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>Activity Management</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" onClick={() => handleBulkPublish('publish')}>Bulk Publish</Button>
                <Button variant="secondary" onClick={() => handleBulkPublish('draft')}>Bulk Draft</Button>
              </div>
            </div>
            {loading ? <p>Loading activities...</p> : (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th><th>Title</th><th>Category</th><th>Creator</th><th>XP</th><th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activities.map(a => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>{a.title}</td>
                        <td>{a.category}</td>
                        <td>
                          {a.creator_username ? (
                            <span>
                              @{a.creator_username}
                              {a.creator_is_admin && <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>🏛️</span>}
                            </span>
                          ) : '—'}
                        </td>
                        <td>{a.xp_reward || 50}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '12px', background: a.visibility_state === 'publish' ? '#4CAF50' : '#FFC107', color: '#fff', fontSize: '0.8rem' }}>{a.visibility_state || 'publish'}</span></td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            {a.visibility_state !== 'publish' && (
                              <Button variant="primary" onClick={() => setActivityVisibility(a.id, 'publish')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Approve</Button>
                            )}
                            {a.visibility_state === 'publish' && (
                              <Button variant="secondary" onClick={() => setActivityVisibility(a.id, 'draft')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Unpublish</Button>
                            )}
                            <button onClick={() => deleteActivity(a.id)} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', padding: '4px' }} title="Delete"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'create' && (
          <Card className={styles.card}>
            <h2>Route Builder & XP Assignment</h2>
            <form onSubmit={handleCreateActivity}>
              <div className={styles.formGroup}>
                <label>Title</label>
                <input type="text" className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>Category</label>
                  <select className={styles.input} value={category} onChange={e => setCategory(e.target.value)}>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.emoji} {c.name}</option>
                    ))}
                    {categories.length === 0 && <option value="">No categories — create one first</option>}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label>Difficulty (1-5)</label>
                  <input type="number" min="1" max="5" className={styles.input} value={difficulty} onChange={e => setDifficulty(e.target.value)} required />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className={styles.formGroup}>
                  <label>XP Reward Multiplier / Base</label>
                  <input type="number" className={styles.input} value={xpReward} onChange={e => setXpReward(e.target.value)} required />
                </div>
                <div className={styles.formGroup}>
                  <label>Est. Duration (mins)</label>
                  <input type="number" className={styles.input} value={duration} onChange={e => setDuration(e.target.value)} required />
                </div>
              </div>
              {selectedCategory && !requiresDistance && (
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', margin: '0 0 0.75rem' }}>
                  ℹ️ {selectedCategory.name} is a time-based activity — distance and laps are not used for calorie burn.
                </p>
              )}

              {requiresDistance && (
                <div className={styles.formGroup}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={isLoop} onChange={e => setIsLoop(e.target.checked)} style={{ width: 16, height: 16 }} />
                    Connect start and end points (loop route)
                  </label>
                  {isLoop && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label>Laps</label>
                      <input type="number" min="1" max="50" className={styles.input} value={lapCount} onChange={e => setLapCount(e.target.value)} />
                      <small style={{ color: 'var(--color-text-muted)' }}>
                        One lap is {computedDistanceKm.toFixed(2)} km, total {effectiveDistanceKm.toFixed(2)} km.
                      </small>
                    </div>
                  )}
                </div>
              )}

              <div className={styles.formGroup}>
                <label>Search a location, then click the map to draw your route</label>
                <div style={{ position: 'relative' }}>
                  <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                    <MapContainer center={[39.92077, 32.85411]} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
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
                    <MapSearchBar onSelect={(lat, lng) => setFlyTarget([lat, lng])} placeholder="Search city, park, address…" />
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <small style={{ color: 'var(--color-text-muted)' }}>
                    {routePoints.length} points placed
                    {requiresDistance && routePoints.length > 1 && (
                      <> · ≈ {computedDistanceKm.toFixed(2)} km{isLoop && lapCount > 1 ? ` × ${lapCount} laps = ${effectiveDistanceKm.toFixed(2)} km` : ''}</>
                    )}
                  </small>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button variant="secondary" onClick={(e) => { e.preventDefault(); handleUndo(); }} disabled={undoStack.length === 0} style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', opacity: undoStack.length === 0 ? 0.4 : 1 }} title="Undo"><Undo2 size={14} /> Undo</Button>
                    <Button variant="secondary" onClick={(e) => { e.preventDefault(); handleRedo(); }} disabled={redoStack.length === 0} style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', opacity: redoStack.length === 0 ? 0.4 : 1 }} title="Redo"><Redo2 size={14} /> Redo</Button>
                    <Button variant="secondary" onClick={(e) => { e.preventDefault(); handleClearRoute(); }} style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}>Clear</Button>
                  </div>
                </div>
              </div>

              <button type="submit" className={styles.button} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Published Activity'}
              </button>
            </form>
          </Card>
        )}

        {activeTab === 'categories' && (
          <Card className={styles.card}>
            <h2>Category Management</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Create and manage activity categories with custom emojis.</p>

            {/* Create / Edit form */}
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCatName.trim()) return;
              try {
                const url = editingCat ? `/api/admin/categories/${editingCat.id}` : '/api/admin/categories';
                const method = editingCat ? 'PUT' : 'POST';
                const res = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({
                    name: newCatName,
                    emoji: newCatEmoji,
                    color: newCatColor,
                    calorie_met: parseFloat(newCatMet) || 4.0,
                    requires_distance: !!newCatRequiresDistance,
                  })
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.detail || 'Failed');
                }
                addToast(editingCat ? 'Category updated!' : 'Category created!', 'success');
                setNewCatName(''); setNewCatEmoji('📍'); setNewCatColor('#4CAF50'); setNewCatMet(4.0); setNewCatRequiresDistance(true); setEditingCat(null);
                fetchCategories();
              } catch (err) {
                addToast(err.message, 'error');
              }
            }} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div className={styles.formGroup} style={{ flex: 2, minWidth: '140px', marginBottom: 0 }}>
                <label>Name</label>
                <input type="text" className={styles.input} value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Swimming" required />
              </div>
              <div className={styles.formGroup} style={{ flex: 0.5, minWidth: '70px', marginBottom: 0 }}>
                <label>Emoji</label>
                <input type="text" className={styles.input} value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} maxLength={4} />
              </div>
              <div className={styles.formGroup} style={{ flex: 0.5, minWidth: '70px', marginBottom: 0 }}>
                <label>Color</label>
                <input type="color" className={styles.input} value={newCatColor} onChange={e => setNewCatColor(e.target.value)} style={{ padding: '4px', height: '42px' }} />
              </div>
              <div className={styles.formGroup} style={{ flex: 0.8, minWidth: '90px', marginBottom: 0 }}>
                <label title="Metabolic Equivalent of Task — controls calorie burn (yoga ~2.5, walking ~3.5, running ~9.8)">MET</label>
                <input type="number" step="0.1" min="1" max="20" className={styles.input} value={newCatMet} onChange={e => setNewCatMet(e.target.value)} />
              </div>
              <div className={styles.formGroup} style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                <label title="Uncheck for activities with no meaningful distance (yoga, climbing, bird watching). Calories then come from elapsed session time only.">Tracks distance?</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: 42, fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={newCatRequiresDistance} onChange={e => setNewCatRequiresDistance(e.target.checked)} style={{ width: 16, height: 16 }} />
                  {newCatRequiresDistance ? 'Yes' : 'No (time-based)'}
                </label>
              </div>
              <Button variant="primary" type="submit" style={{ minWidth: '110px' }}>
                <Plus size={16} style={{ marginRight: '0.3rem' }} /> {editingCat ? 'Update' : 'Add'}
              </Button>
              {editingCat && (
                <Button variant="secondary" onClick={() => { setEditingCat(null); setNewCatName(''); setNewCatEmoji('📍'); setNewCatColor('#4CAF50'); setNewCatMet(4.0); setNewCatRequiresDistance(true); }} style={{ minWidth: '80px' }}>Cancel</Button>
              )}
            </form>

            {/* Categories list */}
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Emoji</th><th>Name</th><th>Color</th><th title="Metabolic Equivalent of Task">MET</th><th title="Whether the activity tracks distance">Distance?</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                </thead>
                <tbody>
                  {categories.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontSize: '1.5rem' }}>{c.emoji}</td>
                      <td>{c.name}</td>
                      <td><span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: c.color, verticalAlign: 'middle' }}></span></td>
                      <td>{c.calorie_met ?? 4.0}</td>
                      <td>{(c.requires_distance ?? true) ? '✅' : '⏱️ time'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button onClick={() => { setEditingCat(c); setNewCatName(c.name); setNewCatEmoji(c.emoji); setNewCatColor(c.color); setNewCatMet(c.calorie_met ?? 4.0); setNewCatRequiresDistance(c.requires_distance ?? true); }} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '4px', minHeight: 'unset' }} title="Edit"><Edit3 size={16} /></button>
                          <button onClick={async () => {
                            if (!confirm(`Delete category "${c.name}"?`)) return;
                            await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                            addToast('Category deleted', 'info');
                            fetchCategories();
                          }} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', padding: '4px', minHeight: 'unset' }} title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>No categories yet. Create one above!</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
