import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, Edit3, Plus } from 'lucide-react';
import styles from './AdminPage.module.css';

// Fix leaflet marker icon paths
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
      {points.length > 1 && <Polyline positions={points} color="blue" />}
    </>
  );
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
  const [distanceKm, setDistanceKm] = useState(0);
  const [routePoints, setRoutePoints] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Category form state
  const [newCatName, setNewCatName] = useState('');
  const [newCatEmoji, setNewCatEmoji] = useState('📍');
  const [newCatColor, setNewCatColor] = useState('#4CAF50');
  const [newCatMet, setNewCatMet] = useState(4.0);
  const [editingCat, setEditingCat] = useState(null);

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
          distance_km: parseFloat(distanceKm) || 0,
          route_polyline: JSON.stringify(routePoints),
          visibility_state: 'publish'
        })
      });
      
      if (res.ok) {
        addToast("Activity created successfully!", "success");
        setTitle('');
        setRoutePoints([]);
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
              <div className={styles.formGroup}>
                <label>Distance (km)</label>
                <input type="number" step="0.1" min="0" className={styles.input} value={distanceKm} onChange={e => setDistanceKm(e.target.value)} placeholder="e.g. 3.5" />
              </div>
              
              <div className={styles.formGroup}>
                <label>Draw Route (Click to place start point and path markers)</label>
                <div style={{ height: '300px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--glass-border)' }}>
                  <MapContainer center={[39.92077, 32.85411]} zoom={6} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                    <RouteBuilderMap points={routePoints} setPoints={setRoutePoints} />
                  </MapContainer>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                  <small style={{ color: 'var(--color-text-muted)' }}>{routePoints.length} points placed.</small>
                  <Button variant="secondary" onClick={(e) => { e.preventDefault(); setRoutePoints([]); }} style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}>Clear Map</Button>
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
                  body: JSON.stringify({ name: newCatName, emoji: newCatEmoji, color: newCatColor, calorie_met: parseFloat(newCatMet) || 4.0 })
                });
                if (!res.ok) {
                  const err = await res.json().catch(() => ({}));
                  throw new Error(err.detail || 'Failed');
                }
                addToast(editingCat ? 'Category updated!' : 'Category created!', 'success');
                setNewCatName(''); setNewCatEmoji('📍'); setNewCatColor('#4CAF50'); setNewCatMet(4.0); setEditingCat(null);
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
              <Button variant="primary" type="submit" style={{ minWidth: '110px' }}>
                <Plus size={16} style={{ marginRight: '0.3rem' }} /> {editingCat ? 'Update' : 'Add'}
              </Button>
              {editingCat && (
                <Button variant="secondary" onClick={() => { setEditingCat(null); setNewCatName(''); setNewCatEmoji('📍'); setNewCatColor('#4CAF50'); setNewCatMet(4.0); }} style={{ minWidth: '80px' }}>Cancel</Button>
              )}
            </form>

            {/* Categories list */}
            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Emoji</th><th>Name</th><th>Color</th><th title="Metabolic Equivalent of Task">MET</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                </thead>
                <tbody>
                  {categories.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontSize: '1.5rem' }}>{c.emoji}</td>
                      <td>{c.name}</td>
                      <td><span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: c.color, verticalAlign: 'middle' }}></span></td>
                      <td>{c.calorie_met ?? 4.0}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                          <button onClick={() => { setEditingCat(c); setNewCatName(c.name); setNewCatEmoji(c.emoji); setNewCatColor(c.color); setNewCatMet(c.calorie_met ?? 4.0); }} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '4px', minHeight: 'unset' }} title="Edit"><Edit3 size={16} /></button>
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
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>No categories yet. Create one above!</td></tr>
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
