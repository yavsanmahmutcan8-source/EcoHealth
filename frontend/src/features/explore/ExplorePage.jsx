import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Search, Map, Loader } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ActiveSessionModal } from './ActiveSessionModal';
import styles from './ExplorePage.module.css';

// Fix leaflet marker icon paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    async function fetchActivities() {
      try {
        const res = await fetch('/api/activities');
        if (res.ok) {
          const data = await res.json();
          // Provide visual emoji fallbacks just in case the backend payload misses some Image icon data.
          const enriched = data.map(dbActivity => ({
            ...dbActivity,
            image: dbActivity.image || (dbActivity.category === 'Hiking' ? '🥾' : dbActivity.category === 'Running' ? '🏃' : dbActivity.category === 'Cycling' ? '🚵' : '📍'),
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
    }
    fetchActivities();
  }, []);

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
              <option value="Hiking">Hiking</option>
              <option value="Running">Running</option>
              <option value="Cycling">Cycling</option>
              <option value="Walking">Walking</option>
            </select>
          </div>
        </div>

        <div className={styles.mapWrapper} style={{ height: '400px', width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: '2rem' }}>
          <MapContainer center={[39.92077, 32.85411]} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
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
            filtered.map(activity => (
              <Card key={activity.id} className={styles.card} hoverable>
                <div className={styles.image}>{activity.image}</div>
                <div className={styles.content}>
                   <div className={styles.metaTop}>
                     <span className={styles.category}>{activity.category}</span>
                     <span className={styles.difficulty}>Diff {activity.difficulty}/10</span>
                   </div>
                   <h3>{activity.title}</h3>
                   <div className={styles.metaBottom}>
                     <span className={styles.location}><Map size={14}/> {activity.loc}</span>
                     <span className={styles.time}>{activity.time}</span>
                   </div>
                   <Button 
                     variant="primary" 
                     style={{ marginTop: '1rem', width: '100%' }}
                     onClick={() => setSelectedActivity(activity)}
                   >
                     Complete Activity
                   </Button>
                </div>
              </Card>
            ))
          )}
        </div>
      </main>

      <ActiveSessionModal 
        isOpen={!!selectedActivity} 
        onClose={() => setSelectedActivity(null)} 
        activity={selectedActivity} 
      />
    </div>
  );
}
