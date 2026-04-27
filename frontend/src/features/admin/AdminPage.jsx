import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import styles from './AdminPage.module.css';

export function AdminPage() {
  const token = useAuthStore(state => state.token);
  const addToast = useToastStore(state => state.addToast);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Activity form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Hiking');
  const [difficulty, setDifficulty] = useState(1);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      } else {
        addToast("Failed to fetch users", "error");
      }
    } catch (err) {
      console.error(err);
      addToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateActivity = async (e) => {
    e.preventDefault();
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
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          visibility_state: 'publish'
        })
      });
      
      if (res.ok) {
        addToast("Activity created successfully!", "success");
        setTitle('');
        setLatitude('');
        setLongitude('');
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

        <div className={styles.grid}>
          <Card className={styles.card}>
            <h2>User Management</h2>
            {loading ? (
              <p>Loading users...</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Level</th>
                      <th>XP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>{u.id}</td>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.level}</td>
                        <td>{u.xp}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className={styles.card}>
            <h2>Create Activity</h2>
            <form onSubmit={handleCreateActivity}>
              <div className={styles.formGroup}>
                <label>Title</label>
                <input 
                  type="text" 
                  className={styles.input} 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  required 
                />
              </div>
              
              <div className={styles.formGroup}>
                <label>Category</label>
                <select 
                  className={styles.input} 
                  value={category} 
                  onChange={e => setCategory(e.target.value)}
                >
                  <option value="Hiking">Hiking</option>
                  <option value="Running">Running</option>
                  <option value="Cycling">Cycling</option>
                  <option value="Walking">Walking</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label>Difficulty (1-5)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="5" 
                  className={styles.input} 
                  value={difficulty} 
                  onChange={e => setDifficulty(e.target.value)} 
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label>Latitude</label>
                <input 
                  type="number" 
                  step="any"
                  className={styles.input} 
                  value={latitude} 
                  onChange={e => setLatitude(e.target.value)} 
                  required 
                />
              </div>

              <div className={styles.formGroup}>
                <label>Longitude</label>
                <input 
                  type="number" 
                  step="any"
                  className={styles.input} 
                  value={longitude} 
                  onChange={e => setLongitude(e.target.value)} 
                  required 
                />
              </div>

              <button type="submit" className={styles.button} disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Activity'}
              </button>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
