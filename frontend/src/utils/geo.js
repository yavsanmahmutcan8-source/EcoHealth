// Geo helpers shared by route-builder UIs.

// Haversine distance between two [lat, lng] points, kilometres.
export function haversineKm(a, b) {
  if (!a || !b) return 0;
  const R = 6371; // km
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Total polyline length, kilometres. If `loop` is true the closing
// segment (last → first) is included.
export function polylineDistanceKm(points, loop = false) {
  if (!Array.isArray(points) || points.length < 2) return 0;
  let d = 0;
  for (let i = 1; i < points.length; i += 1) {
    d += haversineKm(points[i - 1], points[i]);
  }
  if (loop) {
    d += haversineKm(points[points.length - 1], points[0]);
  }
  return d;
}
