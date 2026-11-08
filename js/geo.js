// Petits outils géométriques (coordonnées GeoJSON : [lon, lat]).

function polygons(geometry) {
  return geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
}

function inRing([x, y], ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function pointInGeometry(pt, geometry) {
  return polygons(geometry).some(
    ([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h)),
  );
}

export function bbox(geometry) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const poly of polygons(geometry))
    for (const [x, y] of poly[0]) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  return [minX, minY, maxX, maxY];
}

// Surface approximative en km² (projection équirectangulaire locale, suffisant à l'échelle d'un canton)
export function areaKm2(geometry) {
  const R = 6371.0088;
  let total = 0;
  for (const poly of polygons(geometry)) {
    poly.forEach((ring, k) => {
      const lat0 = (ring[0][1] * Math.PI) / 180;
      let s = 0;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [x1, y1] = ring[j];
        const [x2, y2] = ring[i];
        s += x1 * y2 - x2 * y1;
      }
      const a = Math.abs(s / 2) * ((Math.PI / 180) ** 2) * R * R * Math.cos(lat0);
      total += k === 0 ? a : -a;
    });
  }
  return total;
}

export function haversineKm([lon1, lat1], [lon2, lat2]) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
}

// Point aléatoire dans le canton, hors des lacs.
export function randomPointIn(geometry, excluded = []) {
  const [minX, minY, maxX, maxY] = bbox(geometry);
  for (let n = 0; n < 500; n++) {
    const pt = [minX + Math.random() * (maxX - minX), minY + Math.random() * (maxY - minY)];
    if (pointInGeometry(pt, geometry) && !excluded.some((g) => pointInGeometry(pt, g))) return pt;
  }
  return null;
}

// Masque « tout sauf le canton » : un polygone monde avec le canton en trous.
export function inverseMask(geometry) {
  const world = [[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]];
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "Polygon", coordinates: [world, ...polygons(geometry).map((p) => p[0])] },
  };
}

// Distance (km) d'un point au segment de droite le plus proche ; segments : [[a, b], ...]
export function distToSegmentsKm(pt, segments) {
  const kx = 111.32 * Math.cos((pt[1] * Math.PI) / 180);
  const ky = 110.57;
  let best = Infinity;
  for (const [a, b] of segments) {
    const ax = (a[0] - pt[0]) * kx, ay = (a[1] - pt[1]) * ky;
    const bx = (b[0] - pt[0]) * kx, by = (b[1] - pt[1]) * ky;
    const dx = bx - ax, dy = by - ay;
    const len = dx * dx + dy * dy;
    const t = len ? Math.min(1, Math.max(0, -(ax * dx + ay * dy) / len)) : 0;
    const d = Math.hypot(ax + t * dx, ay + t * dy);
    if (d < best) best = d;
  }
  return best;
}

// Tronçons de la frontière nationale qui bordent une géométrie de canton :
// les deux couches viennent de la même topologie, leurs sommets coïncident exactement.
export function sharedSegments(geometry, countryGeometry) {
  const outer = countryGeometry.type === "Polygon" ? [countryGeometry.coordinates[0]] : countryGeometry.coordinates.map((p) => p[0]);
  const keys = new Set(outer.flat().map((p) => p.join(",")));
  const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const segs = [];
  for (const [ring] of polys)
    for (let k = 1; k < ring.length; k++)
      if (keys.has(ring[k - 1].join(",")) && keys.has(ring[k].join(","))) segs.push([ring[k - 1], ring[k]]);
  return segs;
}
