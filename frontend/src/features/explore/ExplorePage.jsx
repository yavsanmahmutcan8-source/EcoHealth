import React, { useState } from 'react';
import { Navbar } from '../../components/layout/Navbar';
import { Card } from '../../components/ui/Card';
import { Search, Map } from 'lucide-react';
import styles from './ExplorePage.module.css';

const ALL_ACTIVITIES = [
  { id: 1, title: 'Sunrise Mountain Hike', difficulty: 'Moderate', time: '2 hrs', category: 'Hiking', loc: 'North Peak', image: '🏔️' },
  { id: 2, title: 'Lakeside Jogging', difficulty: 'Easy', time: '45 mins', category: 'Running', loc: 'Crystal Lake', image: '🏃' },
  { id: 3, title: 'Deep Forest Trail', difficulty: 'Hard', time: '3.5 hrs', category: 'Hiking', loc: 'Pine Woods', image: '🌲' },
  { id: 4, title: 'Canyon Bike Ride', difficulty: 'Moderate', time: '1.5 hrs', category: 'Cycling', loc: 'Red Rock Canyon', image: '🚴' },
  { id: 5, title: 'City Park Walk', difficulty: 'Easy', time: '30 mins', category: 'Walking', loc: 'Central Park', image: '🚶' },
];

export function ExplorePage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const filtered = ALL_ACTIVITIES.filter(a => {
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

        <div className={styles.grid}>
          {filtered.map(activity => (
            <Card key={activity.id} className={styles.card} hoverable>
              <div className={styles.image}>{activity.image}</div>
              <div className={styles.content}>
                 <div className={styles.metaTop}>
                   <span className={styles.category}>{activity.category}</span>
                   <span className={styles.difficulty}>{activity.difficulty}</span>
                 </div>
                 <h3>{activity.title}</h3>
                 <div className={styles.metaBottom}>
                   <span className={styles.location}><Map size={14}/> {activity.loc}</span>
                   <span className={styles.time}>{activity.time}</span>
                 </div>
              </div>
            </Card>
          ))}
          {filtered.length === 0 && <p className={styles.empty}>No activities found matching your filters.</p>}
        </div>
      </main>
    </div>
  );
}
