import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { MapContainer, TileLayer, Marker, Polyline, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Trash2, Edit3, Plus, Undo2, Redo2, MessageSquare, AlertTriangle, ShieldOff, ShieldCheck, Eye, Flag } from 'lucide-react';
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

// Activity submission_status pill
function StatusPill({ visibility, submission }) {
  if (submission === 'pending_review') {
    return <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#1976d2', color: '#fff', fontSize: '0.75rem' }}>Ready for Review</span>;
  }
  if (submission === 'changes_requested') {
    return <span style={{ padding: '2px 8px', borderRadius: '12px', background: '#ff9800', color: '#fff', fontSize: '0.75rem' }}>Changes Requested</span>;
  }
  const bg = visibility === 'publish' ? '#4CAF50' : '#FFC107';
  return <span style={{ padding: '2px 8px', borderRadius: '12px', background: bg, color: '#fff', fontSize: '0.75rem' }}>{visibility || 'publish'}</span>;
}

export function AdminPage() {
  const navigate = useNavigate();
  const token = useAuthStore(state => state.token);
  const addToast = useToastStore(state => state.addToast);
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // users | activities | reports | create | categories

  // Activity tab state
  const [activitiesFilter, setActivitiesFilter] = useState('all'); // all | publish | draft | pending_review | changes_requested
  const [selectedActivityIds, setSelectedActivityIds] = useState(new Set());
  const [feedbackTarget, setFeedbackTarget] = useState(null); // activity object
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Reports tab state
  const [reportsTab, setReportsTab] = useState('activities'); // activities | users
  const [reportedActivities, setReportedActivities] = useState([]);
  const [reportedUsers, setReportedUsers] = useState([]);
  const [expandedReport, setExpandedReport] = useState(null); // { kind: 'activity'|'user', id, items: [] }
  const [warnTarget, setWarnTarget] = useState(null); // user object
  const [warnMessage, setWarnMessage] = useState('');
  const [banTarget, setBanTarget] = useState(null);
  const [banReason, setBanReason] = useState('');

  // Activity form state (Route Builder)
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

  // ---------------- Fetchers ----------------

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setUsers(await res.json());
    } catch (err) { console.error(err); }
  };

  const fetchActivities = async () => {
    try {
      const res = await fetch('/api/admin/activities', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setActivities(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
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

  const fetchReports = async () => {
    try {
      const [actsRes, usersRes] = await Promise.all([
        fetch('/api/admin/reports/activities', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/admin/reports/users', { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (actsRes.ok) setReportedActivities(await actsRes.json());
      if (usersRes.ok) setReportedUsers(await usersRes.json());
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (!token) return;
    fetchUsers();
    fetchActivities();
    fetchCategories();
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ---------------- Activities tab actions ----------------

  const filteredActivities = useMemo(() => {
    if (activitiesFilter === 'all') return activities;
    if (activitiesFilter === 'publish') return activities.filter(a => a.visibility_state === 'publish');
    if (activitiesFilter === 'draft') return activities.filter(a => a.visibility_state === 'draft' && !a.submission_status);
    if (activitiesFilter === 'pending_review') return activities.filter(a => a.submission_status === 'pending_review');
    if (activitiesFilter === 'changes_requested') return activities.filter(a => a.submission_status === 'changes_requested');
    return activities;
  }, [activitiesFilter, activities]);

  const toggleSelectActivity = (id) => {
    setSelectedActivityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAllFiltered = () => {
    const allIds = filteredActivities.map(a => a.id);
    const allSelected = allIds.every(id => selectedActivityIds.has(id));
    setSelectedActivityIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allIds.forEach(id => next.delete(id));
      } else {
        allIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const runBulkAction = async (action) => {
    const ids = Array.from(selectedActivityIds);
    if (ids.length === 0) {
      addToast('No activities selected', 'error');
      return;
    }
    if (action === 'delete' && !confirm(`Delete ${ids.length} activities permanently?`)) return;
    try {
      const res = await fetch('/api/admin/activities/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ids, action }),
      });
      if (!res.ok) throw new Error('Bulk action failed');
      const data = await res.json();
      addToast(`${data.affected} activities ${action === 'delete' ? 'deleted' : action + 'ed'}`, 'success');
      setSelectedActivityIds(new Set());
      fetchActivities();
    } catch (err) {
      addToast(err.message || 'Bulk action failed', 'error');
    }
  };

  const setActivityVisibility = async (id, state) => {
    try {
      const res = await fetch(`/api/admin/activities/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ visibility_state: state, submission_status: state === 'publish' ? null : undefined }),
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
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed');
      addToast('Activity deleted', 'info');
      fetchActivities();
    } catch {
      addToast('Failed to delete activity', 'error');
    }
  };

  const submitFeedback = async () => {
    if (!feedbackTarget || !feedbackMessage.trim()) return;
    try {
      const res = await fetch(`/api/admin/activities/${feedbackTarget.id}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: feedbackMessage.trim() }),
      });
      if (!res.ok) throw new Error('Failed to send feedback');
      addToast('Feedback sent to creator', 'success');
      setFeedbackTarget(null);
      setFeedbackMessage('');
      fetchActivities();
    } catch (err) {
      addToast(err.message || 'Failed to send feedback', 'error');
    }
  };

  // ---------------- Reports tab actions ----------------

  const openReportDetail = async (kind, id) => {
    try {
      const url = kind === 'activity' ? `/api/admin/reports/activities/${id}` : `/api/admin/reports/users/${id}`;
      const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      const items = await res.json();
      setExpandedReport({ kind, id, items });
    } catch (err) {
      addToast('Failed to load report details', 'error');
    }
  };

  const resolveActivityReport = async (activityId, action, note) => {
    try {
      const res = await fetch(`/api/admin/reports/activities/${activityId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action, note: note || null }),
      });
      if (!res.ok) throw new Error('Failed');
      addToast(`Reports updated: ${action}`, 'success');
      setExpandedReport(null);
      fetchReports();
      fetchActivities();
    } catch (err) {
      addToast(err.message || 'Failed', 'error');
    }
  };

  const submitWarning = async () => {
    if (!warnTarget || !warnMessage.trim()) return;
    try {
      const body = { message: warnMessage.trim() };
      // Optional click-through context. When the warning targets a specific
      // comment/activity, the backend deep-links the notification + soft-hides
      // the comment so other users stop seeing it.
      if (warnTarget.review_id) body.review_id = Number(warnTarget.review_id);
      if (warnTarget.activity_id) body.activity_id = Number(warnTarget.activity_id);
      const res = await fetch(`/api/admin/users/${warnTarget.user_id || warnTarget.id}/warn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      addToast('Warning sent', 'success');
      setWarnTarget(null);
      setWarnMessage('');
      fetchReports();
      fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed', 'error');
    }
  };

  const submitBan = async () => {
    if (!banTarget) return;
    try {
      const res = await fetch(`/api/admin/users/${banTarget.user_id || banTarget.id}/ban`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ reason: banReason.trim() || null }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to ban user');
      }
      addToast('User banned', 'success');
      setBanTarget(null);
      setBanReason('');
      fetchReports();
      fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed', 'error');
    }
  };

  const unbanUser = async (id) => {
    if (!confirm('Unban this user?')) return;
    try {
      const res = await fetch(`/api/admin/users/${id}/unban`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) throw new Error('Failed');
      addToast('User unbanned', 'success');
      fetchReports();
      fetchUsers();
    } catch (err) {
      addToast(err.message || 'Failed', 'error');
    }
  };

  const dismissUserReports = async (userId) => {
    try {
      const res = await fetch(`/api/admin/reports/users/${userId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ action: 'dismiss', note: 'No action taken' }),
      });
      if (!res.ok) throw new Error('Failed');
      addToast('Reports dismissed', 'success');
      fetchReports();
    } catch (err) {
      addToast(err.message || 'Failed', 'error');
    }
  };

  // ---------------- Route Builder submit ----------------

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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
        }),
      });

      if (res.ok) {
        addToast("Activity created successfully!", "success");
        setTitle(''); setRoutePoints([]); setUndoStack([]); setRedoStack([]);
        setIsLoop(false); setLapCount(1);
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

  // ---------------- Render ----------------

  const allFilteredSelected = filteredActivities.length > 0 && filteredActivities.every(a => selectedActivityIds.has(a.id));
  const pendingReviewCount = activities.filter(a => a.submission_status === 'pending_review').length;
  const totalReportCount = reportedActivities.reduce((s, r) => s + (r.report_count || 0), 0)
                         + reportedUsers.reduce((s, r) => s + (r.report_count || 0), 0);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <main className={styles.adminContainer} style={{ flex: 1, width: '100%' }}>
        <div className={styles.header}>
          <h1 className="gradient-text">Admin Portal</h1>
          <p>Manage users, activities, and community reports</p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          <Button variant={activeTab === 'users' ? 'primary' : 'secondary'} onClick={() => setActiveTab('users')}>Users</Button>
          <Button variant={activeTab === 'activities' ? 'primary' : 'secondary'} onClick={() => setActiveTab('activities')}>
            Activities {pendingReviewCount > 0 && <span style={{ marginLeft: '0.4rem', background: '#1976d2', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem' }}>{pendingReviewCount}</span>}
          </Button>
          <Button variant={activeTab === 'reports' ? 'primary' : 'secondary'} onClick={() => setActiveTab('reports')}>
            Reports {totalReportCount > 0 && <span style={{ marginLeft: '0.4rem', background: '#f44336', color: '#fff', borderRadius: '10px', padding: '0 6px', fontSize: '0.7rem' }}>{totalReportCount}</span>}
          </Button>
          <Button variant={activeTab === 'create' ? 'primary' : 'secondary'} onClick={() => setActiveTab('create')}>Route Builder</Button>
          <Button variant={activeTab === 'categories' ? 'primary' : 'secondary'} onClick={() => setActiveTab('categories')}>Categories</Button>
        </div>

        {/* ========== USERS TAB ========== */}
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
                      <th>Age</th><th>Sex</th><th>Weight</th><th>Height</th><th>Fitness</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={u.is_banned ? { background: 'rgba(244,67,54,0.08)' } : undefined}>
                        <td>{u.id}</td>
                        <td>
                          <button type="button" onClick={() => navigate(`/profile/${u.username}`)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-primary)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
                            {u.username}
                          </button>
                        </td>
                        <td>{u.email}</td>
                        <td><span style={{ padding: '2px 8px', borderRadius: '12px', background: u.is_admin ? '#4CAF50' : '#e0e0e0', color: u.is_admin ? '#fff' : '#333', fontSize: '0.8rem' }}>{u.is_admin ? 'Admin' : 'User'}</span></td>
                        <td>{u.level}</td>
                        <td>{u.xp}</td>
                        <td>{u.age ?? '—'}</td>
                        <td>{u.sex || '—'}</td>
                        <td>{u.weight_kg ?? '—'}</td>
                        <td>{u.height_cm ?? '—'}</td>
                        <td>{u.fitness_level || '—'}</td>
                        <td>{u.is_banned ? <span style={{ color: '#f44336', fontWeight: 600 }}>Banned</span> : 'Active'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            <button onClick={() => { setWarnTarget({ id: u.id, username: u.username }); }} title="Send warning" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff9800' }}><AlertTriangle size={16} /></button>
                            {!u.is_admin && (u.is_banned
                              ? <button onClick={() => unbanUser(u.id)} title="Unban" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4CAF50' }}><ShieldCheck size={16} /></button>
                              : <button onClick={() => setBanTarget({ id: u.id, username: u.username })} title="Ban" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f44336' }}><ShieldOff size={16} /></button>
                            )}
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

        {/* ========== ACTIVITIES TAB ========== */}
        {activeTab === 'activities' && (
          <Card className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2>Activity Management</h2>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Button variant="primary" onClick={() => runBulkAction('publish')} disabled={selectedActivityIds.size === 0}>Bulk Publish ({selectedActivityIds.size})</Button>
                <Button variant="secondary" onClick={() => runBulkAction('draft')} disabled={selectedActivityIds.size === 0}>Bulk Draft</Button>
                <Button variant="secondary" onClick={() => runBulkAction('delete')} disabled={selectedActivityIds.size === 0} style={{ background: selectedActivityIds.size === 0 ? undefined : '#f44336', color: selectedActivityIds.size === 0 ? undefined : '#fff' }}>Bulk Delete</Button>
              </div>
            </div>

            {/* Filter chips */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', margin: '1rem 0' }}>
              {[
                { id: 'all', label: 'All' },
                { id: 'pending_review', label: `Ready for Review${pendingReviewCount > 0 ? ` (${pendingReviewCount})` : ''}` },
                { id: 'changes_requested', label: 'Changes Requested' },
                { id: 'publish', label: 'Published' },
                { id: 'draft', label: 'Drafts' },
              ].map(f => (
                <button key={f.id} type="button" onClick={() => { setActivitiesFilter(f.id); setSelectedActivityIds(new Set()); }} style={{
                  padding: '0.35rem 0.75rem', borderRadius: '999px', cursor: 'pointer',
                  border: activitiesFilter === f.id ? '2px solid var(--color-primary)' : '1px solid var(--glass-border)',
                  background: activitiesFilter === f.id ? 'rgba(76,175,80,0.15)' : 'var(--glass-bg)',
                  color: 'var(--color-text)', fontSize: '0.8rem', fontWeight: 600,
                }}>{f.label}</button>
              ))}
            </div>

            {loading ? <p>Loading activities...</p> : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}>
                        <input type="checkbox" checked={allFilteredSelected} onChange={toggleSelectAllFiltered} />
                      </th>
                      <th>ID</th><th>Title</th><th>Category</th><th>Creator</th><th>XP</th><th>Status</th><th title="Open reports">Reports</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivities.map(a => (
                      <tr key={a.id} style={a.submission_status === 'pending_review' ? { background: 'rgba(25,118,210,0.06)' } : undefined}>
                        <td>
                          <input type="checkbox" checked={selectedActivityIds.has(a.id)} onChange={() => toggleSelectActivity(a.id)} />
                        </td>
                        <td>{a.id}</td>
                        <td>{a.title}</td>
                        <td>{a.category}</td>
                        <td>
                          {a.creator_username ? (
                            <span>@{a.creator_username}{a.creator_is_admin && <span style={{ marginLeft: 4, fontSize: '0.7rem' }}>🏛️</span>}</span>
                          ) : '—'}
                        </td>
                        <td>{a.xp_reward || 50}</td>
                        <td><StatusPill visibility={a.visibility_state} submission={a.submission_status} /></td>
                        <td>
                          {a.report_count > 0
                            ? <span style={{ color: '#f44336', fontWeight: 600 }}>{a.report_count}</span>
                            : <span style={{ color: 'var(--color-text-muted)' }}>0</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                            {a.visibility_state !== 'publish' && (
                              <Button variant="primary" onClick={() => setActivityVisibility(a.id, 'publish')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Publish</Button>
                            )}
                            {a.visibility_state === 'publish' && (
                              <Button variant="secondary" onClick={() => setActivityVisibility(a.id, 'draft')} style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}>Unpublish</Button>
                            )}
                            <button onClick={() => { setFeedbackTarget(a); setFeedbackMessage(''); }} title="Send feedback to creator" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2' }}><MessageSquare size={16} /></button>
                            <button onClick={() => deleteActivity(a.id)} title="Delete" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f44336' }}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredActivities.length === 0 && (
                      <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>No activities match this filter.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ========== REPORTS TAB ========== */}
        {activeTab === 'reports' && (
          <Card className={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h2>Community Reports</h2>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <Button variant={reportsTab === 'activities' ? 'primary' : 'secondary'} onClick={() => setReportsTab('activities')}>Reported Activities ({reportedActivities.length})</Button>
                <Button variant={reportsTab === 'users' ? 'primary' : 'secondary'} onClick={() => setReportsTab('users')}>Reported Users ({reportedUsers.length})</Button>
              </div>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem', fontSize: '0.85rem' }}>Sorted by total report count. Click a row to see the individual reports and act on them.</p>

            {reportsTab === 'activities' && (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>#</th><th>Activity</th><th>Creator</th><th>State</th><th>Reports</th><th>Open</th><th>Last report</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {reportedActivities.map(r => (
                      <tr key={r.activity_id}>
                        <td>{r.activity_id}</td>
                        <td><strong>{r.title}</strong></td>
                        <td>{r.creator_username ? `@${r.creator_username}` : '—'}</td>
                        <td>{r.visibility_state}</td>
                        <td style={{ fontWeight: 600, color: '#f44336' }}>{r.report_count}</td>
                        <td>{r.pending_count}</td>
                        <td>{r.latest_report_at ? new Date(r.latest_report_at).toLocaleString() : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                            <button onClick={() => openReportDetail('activity', r.activity_id)} title="View reports" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2' }}><Eye size={16} /></button>
                            {r.visibility_state === 'publish' && (
                              <Button variant="secondary" onClick={() => resolveActivityReport(r.activity_id, 'unpublish', 'Unpublished after reports')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Unpublish</Button>
                            )}
                            <Button variant="secondary" onClick={() => resolveActivityReport(r.activity_id, 'dismiss', 'No action taken')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Dismiss</Button>
                            <Button variant="secondary" onClick={() => resolveActivityReport(r.activity_id, 'delete', 'Deleted after reports')} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: '#f44336', color: '#fff' }}>Delete</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reportedActivities.length === 0 && (
                      <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>No reported activities. 🎉</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {reportsTab === 'users' && (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>#</th><th>User</th><th>Reports</th><th>Open</th><th>Banned?</th><th>Last report</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {reportedUsers.map(r => (
                      <tr key={r.user_id}>
                        <td>{r.user_id}</td>
                        <td><strong>@{r.username}</strong>{r.display_name && <span style={{ color: 'var(--color-text-muted)' }}> · {r.display_name}</span>}</td>
                        <td style={{ fontWeight: 600, color: '#f44336' }}>{r.report_count}</td>
                        <td>{r.pending_count}</td>
                        <td>{r.is_banned ? <span style={{ color: '#f44336', fontWeight: 600 }}>Yes</span> : 'No'}</td>
                        <td>{r.latest_report_at ? new Date(r.latest_report_at).toLocaleString() : '—'}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.3rem' }}>
                            <button onClick={() => openReportDetail('user', r.user_id)} title="View reports" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#1976d2' }}><Eye size={16} /></button>
                            <Button variant="secondary" onClick={() => { setWarnTarget(r); }} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Warn</Button>
                            {r.is_banned
                              ? <Button variant="secondary" onClick={() => unbanUser(r.user_id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Unban</Button>
                              : <Button variant="secondary" onClick={() => setBanTarget(r)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem', background: '#f44336', color: '#fff' }}>Ban</Button>
                            }
                            <Button variant="secondary" onClick={() => dismissUserReports(r.user_id)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}>Dismiss</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {reportedUsers.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>No reported users. 🎉</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* ========== ROUTE BUILDER (unchanged from before) ========== */}
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
                    {categories.map(c => (<option key={c.id} value={c.name}>{c.emoji} {c.name}</option>))}
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
                      <small style={{ color: 'var(--color-text-muted)' }}>One lap is {computedDistanceKm.toFixed(2)} km, total {effectiveDistanceKm.toFixed(2)} km.</small>
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
                      {displayPolyline.length > 1 && (<Polyline positions={displayPolyline} color={isLoop ? '#1976d2' : '#4CAF50'} weight={4} />)}
                    </MapContainer>
                  </div>
                  <div style={{ position: 'absolute', top: 10, left: 10, right: 10, zIndex: 1100 }}>
                    <MapSearchBar onSelect={(lat, lng) => setFlyTarget([lat, lng])} placeholder="Search city, park, address…" />
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <small style={{ color: 'var(--color-text-muted)' }}>
                    {routePoints.length} points placed
                    {requiresDistance && routePoints.length > 1 && (<> · ≈ {computedDistanceKm.toFixed(2)} km{isLoop && lapCount > 1 ? ` × ${lapCount} laps = ${effectiveDistanceKm.toFixed(2)} km` : ''}</>)}
                  </small>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Button variant="secondary" onClick={(e) => { e.preventDefault(); handleUndo(); }} disabled={undoStack.length === 0} style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', opacity: undoStack.length === 0 ? 0.4 : 1 }}><Undo2 size={14} /> Undo</Button>
                    <Button variant="secondary" onClick={(e) => { e.preventDefault(); handleRedo(); }} disabled={redoStack.length === 0} style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem', opacity: redoStack.length === 0 ? 0.4 : 1 }}><Redo2 size={14} /> Redo</Button>
                    <Button variant="secondary" onClick={(e) => { e.preventDefault(); handleClearRoute(); }} style={{ padding: '0.25rem 0.55rem', fontSize: '0.75rem' }}>Clear</Button>
                  </div>
                </div>
              </div>
              <button type="submit" className={styles.button} disabled={isSubmitting}>{isSubmitting ? 'Creating...' : 'Create Published Activity'}</button>
            </form>
          </Card>
        )}

        {/* ========== CATEGORIES TAB (unchanged) ========== */}
        {activeTab === 'categories' && (
          <Card className={styles.card}>
            <h2>Category Management</h2>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>Create and manage activity categories with custom emojis.</p>

            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newCatName.trim()) return;
              try {
                const url = editingCat ? `/api/admin/categories/${editingCat.id}` : '/api/admin/categories';
                const method = editingCat ? 'PUT' : 'POST';
                const res = await fetch(url, {
                  method,
                  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                  body: JSON.stringify({ name: newCatName, emoji: newCatEmoji, color: newCatColor, calorie_met: parseFloat(newCatMet) || 4.0, requires_distance: !!newCatRequiresDistance }),
                });
                if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Failed'); }
                addToast(editingCat ? 'Category updated!' : 'Category created!', 'success');
                setNewCatName(''); setNewCatEmoji('📍'); setNewCatColor('#4CAF50'); setNewCatMet(4.0); setNewCatRequiresDistance(true); setEditingCat(null);
                fetchCategories();
              } catch (err) { addToast(err.message, 'error'); }
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
                <label>MET</label>
                <input type="number" step="0.1" min="1" max="20" className={styles.input} value={newCatMet} onChange={e => setNewCatMet(e.target.value)} />
              </div>
              <div className={styles.formGroup} style={{ flex: 1, minWidth: '140px', marginBottom: 0 }}>
                <label>Tracks distance?</label>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', height: 42, fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={newCatRequiresDistance} onChange={e => setNewCatRequiresDistance(e.target.checked)} style={{ width: 16, height: 16 }} />
                  {newCatRequiresDistance ? 'Yes' : 'No (time-based)'}
                </label>
              </div>
              <Button variant="primary" type="submit" style={{ minWidth: '110px' }}><Plus size={16} style={{ marginRight: '0.3rem' }} /> {editingCat ? 'Update' : 'Add'}</Button>
              {editingCat && (<Button variant="secondary" onClick={() => { setEditingCat(null); setNewCatName(''); setNewCatEmoji('📍'); setNewCatColor('#4CAF50'); setNewCatMet(4.0); setNewCatRequiresDistance(true); }}>Cancel</Button>)}
            </form>

            <div style={{ overflowX: 'auto' }}>
              <table className={styles.table}>
                <thead>
                  <tr><th>Emoji</th><th>Name</th><th>Color</th><th>MET</th><th>Distance?</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
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
                          <button onClick={() => { setEditingCat(c); setNewCatName(c.name); setNewCatEmoji(c.emoji); setNewCatColor(c.color); setNewCatMet(c.calorie_met ?? 4.0); setNewCatRequiresDistance(c.requires_distance ?? true); }} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '4px' }}><Edit3 size={16} /></button>
                          <button onClick={async () => { if (!confirm(`Delete category "${c.name}"?`)) return; await fetch(`/api/admin/categories/${c.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } }); addToast('Category deleted', 'info'); fetchCategories(); }} style={{ background: 'none', border: 'none', color: '#f44336', cursor: 'pointer', padding: '4px' }}><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {categories.length === 0 && (<tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem' }}>No categories yet.</td></tr>)}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>

      {/* ===== Feedback Modal ===== */}
      <Modal isOpen={!!feedbackTarget} onClose={() => setFeedbackTarget(null)} title={feedbackTarget ? `Feedback for "${feedbackTarget.title}"` : 'Feedback'}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          Explain what the creator needs to change. The activity will be moved to <strong>Changes Requested</strong> and the creator gets a notification.
        </p>
        <textarea
          value={feedbackMessage}
          onChange={e => setFeedbackMessage(e.target.value)}
          rows={6}
          placeholder="e.g. The starting point is on private property — please move it 200m east to the public trailhead."
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--color-text)', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => setFeedbackTarget(null)}>Cancel</Button>
          <Button variant="primary" onClick={submitFeedback} disabled={!feedbackMessage.trim()}>Send Feedback</Button>
        </div>
      </Modal>

      {/* ===== Report Detail Modal ===== */}
      <Modal isOpen={!!expandedReport} onClose={() => setExpandedReport(null)} title={expandedReport ? `Reports — ${expandedReport.kind === 'activity' ? 'Activity' : 'User'} #${expandedReport.id}` : ''}>
        {expandedReport && expandedReport.items.length === 0 && (
          <p style={{ color: 'var(--color-text-muted)' }}>No individual reports loaded.</p>
        )}
        {expandedReport && expandedReport.items.map(item => (
          <div key={item.id} style={{ padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.4rem' }}>
              <div>
                <strong>@{item.reporter_username}</strong>
                <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>{new Date(item.created_at).toLocaleString()}</span>
              </div>
              <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.7rem', background: '#1976d2', color: '#fff' }}>{item.reason}</span>
            </div>
            {item.details && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>{item.details}</p>}
            <small style={{ color: 'var(--color-text-muted)' }}>Status: {item.status}</small>
          </div>
        ))}
      </Modal>

      {/* ===== Warn Modal ===== */}
      <Modal isOpen={!!warnTarget} onClose={() => { setWarnTarget(null); setWarnMessage(''); }} title={warnTarget ? `Warn @${warnTarget.username}` : 'Warn user'}>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
          The user will receive an in-app notification. Their pending reports are marked <strong>Warned</strong> so any new reports clearly show the warning didn't change behaviour.
        </p>
        <textarea
          value={warnMessage} onChange={e => setWarnMessage(e.target.value)} rows={5}
          placeholder="e.g. We've received reports about your recent comments. Please keep things respectful."
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--color-text)', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Review ID (optional)</label>
            <input
              type="number"
              value={warnTarget?.review_id || ''}
              onChange={e => setWarnTarget(t => t ? { ...t, review_id: e.target.value } : t)}
              placeholder="Hide a specific comment"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--color-text)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Activity ID (optional)</label>
            <input
              type="number"
              value={warnTarget?.activity_id || ''}
              onChange={e => setWarnTarget(t => t ? { ...t, activity_id: e.target.value } : t)}
              placeholder="Link notification to activity"
              style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--color-text)' }}
            />
          </div>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.4rem' }}>
          Setting a Review ID also hides that comment from other users (the author still sees it with a moderation marker).
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => { setWarnTarget(null); setWarnMessage(''); }}>Cancel</Button>
          <Button variant="primary" onClick={submitWarning} disabled={!warnMessage.trim()}>Send Warning</Button>
        </div>
      </Modal>

      {/* ===== Ban Modal ===== */}
      <Modal isOpen={!!banTarget} onClose={() => { setBanTarget(null); setBanReason(''); }} title={banTarget ? `Ban @${banTarget.username}` : 'Ban user'}>
        <p style={{ color: '#f44336', fontSize: '0.85rem' }}>
          ⚠️ Banning blocks all sign-ins and API calls for this user. They can be unbanned later.
        </p>
        <textarea
          value={banReason} onChange={e => setBanReason(e.target.value)} rows={3}
          placeholder="Optional internal note (not shown to the user)"
          style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)', color: 'var(--color-text)', resize: 'vertical', fontFamily: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
          <Button variant="secondary" onClick={() => { setBanTarget(null); setBanReason(''); }}>Cancel</Button>
          <Button variant="primary" onClick={submitBan} style={{ background: '#f44336' }}>Confirm Ban</Button>
        </div>
      </Modal>
    </div>
  );
}
