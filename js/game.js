// Règles du jeu et état de la partie (sans dépendance à la carte ni au DOM).

export const STATION_TYPES = {
  fire: {
    label: "Caserne de pompiers", prefix: "Caserne", cost: 80_000,
    color: "#d62828", icon: "🚒", phone: "118", starter: "tp", capacity: 6,
  },
  ems: {
    label: "Base d'ambulances", prefix: "Base sanitaire", cost: 60_000,
    color: "#e9a800", icon: "🚑", phone: "144", starter: "amb", capacity: 6,
  },
  police: {
    label: "Poste de police", prefix: "Poste de police", cost: 50_000,
    color: "#1d4ed8", icon: "🚓", phone: "117", starter: "pat", capacity: 6,
  },
};

export const VEHICLE_TYPES = {
  tp: { label: "Tonne-pompe", short: "TP", category: "fire", cost: 30_000 },
  ech: { label: "Camion-échelle", short: "ECH", category: "fire", cost: 45_000 },
  amb: { label: "Ambulance", short: "AMB", category: "ems", cost: 25_000 },
  smur: { label: "SMUR (véhicule médecin)", short: "SMUR", category: "ems", cost: 35_000 },
  pat: { label: "Patrouille", short: "PAT", category: "police", cost: 15_000 },
};

// need : véhicules requis sur place ; work : durée de travail sur place (s de jeu)
export const INCIDENT_TYPES = [
  { id: "conteneur", label: "Feu de conteneur", need: { tp: 1 }, reward: 1_500, work: [90, 180], weight: 3 },
  { id: "cave", label: "Inondation de cave", need: { tp: 1 }, reward: 2_000, work: [180, 420], weight: 2 },
  { id: "foret", label: "Feu de broussailles", need: { tp: 2 }, reward: 4_500, work: [300, 600], weight: 1 },
  { id: "appart", label: "Feu d'appartement", need: { tp: 2, ech: 1, amb: 1 }, reward: 12_000, work: [420, 900], weight: 1 },
  { id: "malaise", label: "Malaise sur la voie publique", need: { amb: 1 }, reward: 1_800, work: [150, 300], weight: 4 },
  { id: "chute", label: "Chute d'une personne âgée", need: { amb: 1 }, reward: 1_600, work: [150, 300], weight: 3 },
  { id: "acr", label: "Arrêt cardio-respiratoire", need: { amb: 1, smur: 1 }, reward: 6_000, work: [300, 600], weight: 1 },
  { id: "cambriolage", label: "Cambriolage", need: { pat: 1 }, reward: 1_500, work: [180, 420], weight: 3 },
  { id: "bagarre", label: "Bagarre", need: { pat: 2 }, reward: 3_000, work: [180, 360], weight: 2 },
  { id: "accident", label: "Accident de la circulation", need: { pat: 1, amb: 1 }, reward: 4_000, work: [240, 480], weight: 3 },
  { id: "incarc", label: "Accident avec personne incarcérée", need: { tp: 1, amb: 1, pat: 1 }, reward: 9_000, work: [420, 900], weight: 1 },
];

export const STATUS_LABEL = {
  dispo: "Disponible",
  alerte: "Alerté",
  route: "En route",
  place: "Sur place",
  retour: "Retour",
};

// Facteur appliqué à la durée OSRM : conduite en urgence (feux bleus / sirène)
export const URGENT_FACTOR = 0.75;
export const MAX_OPEN_INCIDENTS = 10;
// Les appels arrivent des communes situées à moins de COVER_KM d'un bâtiment concerné :
// plus tu construis, plus ta zone de couverture (et ton activité) s'étend.
export const COVER_KM = 12;
export const UNATTENDED_TIMEOUT = 25 * 60; // une intervention ignorée 25 min de jeu est perdue
const SAVE_KEY = "secours-suisse-v1";

export function newGame(cantonId, budget) {
  return {
    version: 1,
    cantonId,
    money: budget,
    time: 8 * 3600, // jour 1, 08:00
    nextId: 1,
    stations: [],
    vehicles: [],
    incidents: [],
    nextSpawnAt: null,
    stats: { done: 0, missed: 0, earned: 0 },
  };
}

export function uid(state, prefix) {
  return `${prefix}${state.nextId++}`;
}

export function rand([a, b]) {
  return a + Math.random() * (b - a);
}

export function pickIncidentType(categories) {
  const pool = INCIDENT_TYPES.filter((t) =>
    Object.keys(t.need).every((v) => categories.has(VEHICLE_TYPES[v].category)),
  );
  if (!pool.length) return null;
  let r = Math.random() * pool.reduce((s, t) => s + t.weight, 0);
  for (const t of pool) if ((r -= t.weight) <= 0) return t;
  return pool[pool.length - 1];
}

// Intervalle moyen entre deux appels, en secondes de jeu
export function spawnInterval(pop) {
  const mean = Math.min(600, Math.max(90, 240 * Math.sqrt(300_000 / pop)));
  return -Math.log(1 - Math.random()) * mean; // loi exponentielle
}

export function incidentType(id) {
  return INCIDENT_TYPES.find((t) => t.id === id);
}

// Besoins restants : requis - (sur place + en route)
export function missingUnits(state, incident) {
  const need = { ...incidentType(incident.typeId).need };
  for (const vid of incident.assigned) {
    const v = state.vehicles.find((x) => x.id === vid);
    if (v && need[v.type] > 0) need[v.type]--;
  }
  return Object.fromEntries(Object.entries(need).filter(([, n]) => n > 0));
}

export function requirementsMetOnScene(state, incident) {
  const need = { ...incidentType(incident.typeId).need };
  for (const vid of incident.assigned) {
    const v = state.vehicles.find((x) => x.id === vid);
    if (v && v.status === "place" && need[v.type] > 0) need[v.type]--;
  }
  return Object.values(need).every((n) => n <= 0);
}

export function formatMoney(n) {
  return `${Math.round(n).toLocaleString("fr-CH")} CHF`;
}

export function formatClock(t) {
  const day = Math.floor(t / 86400) + 1;
  const s = t % 86400;
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  return `Jour ${day} · ${hh}:${mm}`;
}

export function formatDuration(s) {
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

// --- Sauvegarde locale ---
// Les trajets en cours ne sont pas sauvegardés : au chargement, les véhicules sont
// rentrés en caserne et les interventions repartent sans moyens engagés.
export function save(state) {
  const copy = {
    ...state,
    vehicles: state.vehicles.map(({ trip, ...v }) => v),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(copy));
  } catch (e) {
    console.warn("Sauvegarde impossible", e);
  }
}

export function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw);
    if (state.version !== 1) return null;
    for (const v of state.vehicles) {
      const st = state.stations.find((s) => s.id === v.stationId);
      v.status = "dispo";
      v.incidentId = null;
      v.pos = st.pos.slice();
    }
    for (const i of state.incidents) {
      i.assigned = [];
      i.status = "nouveau";
      i.workEnd = null;
    }
    return state;
  } catch (e) {
    console.warn("Sauvegarde illisible", e);
    return null;
  }
}

export function wipeSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {}
}
