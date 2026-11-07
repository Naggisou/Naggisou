// Itinéraires sur le vrai réseau routier (OpenStreetMap) via un serveur OSRM.
// Le serveur de démo public est limité (usage raisonnable) : pour un vrai déploiement,
// héberger son propre OSRM avec l'extrait Suisse de Geofabrik et changer OSRM_URL.
import { haversineKm } from "./geo.js";

export const OSRM_URL = "https://router.project-osrm.org";

const cache = new Map();

// Retourne { coords: [[lat, lon], ...], distanceKm, durationS, offline }
export async function route(from, to) {
  const key = `${from.join(",")};${to.join(",")}`;
  if (cache.has(key)) return cache.get(key);
  const url =
    `${OSRM_URL}/route/v1/driving/${from[0]},${from[1]};${to[0]},${to[1]}` +
    `?overview=full&geometries=geojson`;
  let result;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes.length) throw new Error(data.code);
    const r = data.routes[0];
    result = {
      coords: r.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
      distanceKm: r.distance / 1000,
      durationS: r.duration,
      offline: false,
    };
  } catch (err) {
    // Repli : ligne droite à 50 km/h si le serveur de routage est injoignable.
    console.warn("Routage indisponible, repli en ligne droite :", err);
    const km = haversineKm(from, to) * 1.3;
    result = {
      coords: [[from[1], from[0]], [to[1], to[0]]],
      distanceKm: km,
      durationS: (km / 50) * 3600,
      offline: true,
    };
  }
  cache.set(key, result);
  return result;
}

// Accroche un point au réseau routier le plus proche ; renvoie { pt: [lon, lat], street }
export async function snapToRoad(pt) {
  try {
    const res = await fetch(`${OSRM_URL}/nearest/v1/driving/${pt[0]},${pt[1]}?number=1`);
    const data = await res.json();
    if (data.code !== "Ok") throw new Error(data.code);
    const w = data.waypoints[0];
    return { pt: w.location, street: w.name || "", distanceM: w.distance };
  } catch {
    return { pt, street: "", distanceM: 0 };
  }
}
