import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader, X } from 'lucide-react';

/**
 * Lightweight location search using OpenStreetMap Nominatim.
 * Floats over a leaflet map (caller positions it absolutely).
 * Calls `onSelect(lat, lng, displayName)` when a result is picked.
 *
 * Nominatim usage policy requires a descriptive User-Agent / Referer and
 * at most 1 req/s. We debounce input by 500 ms.
 */
export function MapSearchBar({ onSelect, placeholder = 'Search a place…' }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.trim().length < 3) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=0`;
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          setResults(data);
          setOpen(true);
        }
      } catch {
        // network failure — silently ignore, user can retry
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const handlePick = (r) => {
    const lat = parseFloat(r.lat);
    const lng = parseFloat(r.lon);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      onSelect(lat, lng, r.display_name);
    }
    setOpen(false);
    setQuery(r.display_name);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#666', pointerEvents: 'none' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          style={{
            width: '100%',
            padding: '8px 32px 8px 32px',
            borderRadius: 8,
            border: '1px solid rgba(0,0,0,0.15)',
            background: '#fff',
            color: '#222',
            fontSize: '0.85rem',
            outline: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
          }}
        />
        {loading && (
          <Loader size={14} className="spin" style={{ position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)', color: '#666' }} />
        )}
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            aria-label="Clear search"
            style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#888' }}
          >
            <X size={14} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <ul style={{
          listStyle: 'none', margin: '4px 0 0', padding: 0,
          background: '#fff', border: '1px solid rgba(0,0,0,0.15)',
          borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: 240, overflowY: 'auto',
          position: 'absolute', top: '100%', left: 0, right: 0,
          zIndex: 1100,
        }}>
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => handlePick(r)}
                style={{
                  width: '100%', textAlign: 'left', padding: '8px 10px',
                  background: 'none', border: 'none', borderBottom: '1px solid #eee',
                  cursor: 'pointer', fontSize: '0.8rem', color: '#222',
                }}
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
