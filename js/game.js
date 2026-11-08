// Règles du jeu et état de la partie (sans dépendance à la carte ni au DOM).

export const STATION_TYPES = {
  fire: {
    label: "Caserne de pompiers", prefix: "Caserne", cost: 80_000,
    color: "#d62828", icon: "🚒", phone: "118", starter: "tp", capacity: 12,
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
  // Sapeurs-pompiers
  tp: { label: "Tonne-pompe", short: "TP", category: "fire", cost: 30_000 },
  vpi: { label: "Véhicule de première intervention", short: "VPI", category: "fire", cost: 18_000 },
  ech: { label: "Camion-échelle", short: "ECH", category: "fire", cost: 45_000 },
  ccf: { label: "Camion-citerne feux de forêt", short: "CCF", category: "fire", cost: 35_000 },
  vsr: { label: "Véhicule de sauvetage routier", short: "VSR", category: "fire", cost: 40_000 },
  chim: { label: "Véhicule chimique (ABC)", short: "CHIM", category: "fire", cost: 50_000 },
  vc: { label: "Véhicule de commandement", short: "VC", category: "fire", cost: 20_000 },
  vtp: { label: "Véhicule de transport de personnel", short: "VTP", category: "fire", cost: 15_000 },
  // Sanitaire
  amb: { label: "Ambulance", short: "AMB", category: "ems", cost: 25_000 },
  smur: { label: "SMUR (véhicule médecin)", short: "SMUR", category: "ems", cost: 35_000 },
  // Police
  pat: { label: "Patrouille", short: "PAT", category: "police", cost: 15_000 },
};

// Un besoin peut aussi être couvert par un autre véhicule (ex. une tonne-pompe fait le travail d'un VPI)
export const ALTERNATES = { vpi: ["tp"], vtp: ["tp"] };

// need : véhicules requis sur place ; work : durée de travail sur place (s de jeu)
export const INCIDENT_TYPES = [
  // Pompiers
  { id: "conteneur", label: "Feu de conteneur", need: { vpi: 1 }, reward: 1_500, work: [90, 180], weight: 3 },
  { id: "alarme", label: "Alarme automatique incendie", need: { tp: 1 }, reward: 1_200, work: [60, 180], weight: 3 },
  { id: "cave", label: "Inondation de cave", need: { vpi: 1 }, reward: 2_000, work: [180, 420], weight: 2 },
  { id: "arbre", label: "Arbre tombé sur la route", need: { vpi: 1 }, reward: 1_800, work: [180, 360], weight: 2 },
  { id: "hydro", label: "Pollution aux hydrocarbures", need: { vpi: 1 }, reward: 1_800, work: [150, 300], weight: 2 },
  { id: "voiture", label: "Feu de véhicule", need: { tp: 1 }, reward: 2_500, work: [180, 360], weight: 2 },
  { id: "broussailles", label: "Feu de broussailles", need: { tp: 1, ccf: 1 }, reward: 4_500, work: [300, 600], weight: 1.5 },
  { id: "foret", label: "Feu de forêt", need: { tp: 2, ccf: 2, vc: 1 }, reward: 15_000, work: [900, 1800], weight: 0.4 },
  { id: "appart", label: "Feu d'appartement", need: { tp: 2, ech: 1, amb: 1 }, reward: 12_000, work: [420, 900], weight: 1 },
  { id: "immeuble", label: "Feu d'immeuble", need: { tp: 3, ech: 1, vc: 1, vtp: 1, amb: 1 }, reward: 25_000, work: [900, 1800], weight: 0.4 },
  { id: "gaz", label: "Fuite de gaz", need: { tp: 1, chim: 1, pat: 1 }, reward: 7_000, work: [300, 600], weight: 0.8 },
  { id: "chimique", label: "Accident chimique", need: { tp: 1, chim: 1, vc: 1, amb: 1 }, reward: 14_000, work: [600, 1200], weight: 0.4 },
  { id: "inondation", label: "Inondation majeure", need: { tp: 2, vtp: 1 }, reward: 8_000, work: [600, 1200], weight: 0.5 },
  // Sanitaire
  { id: "malaise", label: "Malaise sur la voie publique", need: { amb: 1 }, reward: 1_800, work: [150, 300], weight: 4 },
  { id: "chute", label: "Chute d'une personne âgée", need: { amb: 1 }, reward: 1_600, work: [150, 300], weight: 3 },
  { id: "acr", label: "Arrêt cardio-respiratoire", need: { amb: 1, smur: 1 }, reward: 6_000, work: [300, 600], weight: 1 },
  // Police
  { id: "cambriolage", label: "Cambriolage", need: { pat: 1 }, reward: 1_500, work: [180, 420], weight: 3 },
  { id: "bagarre", label: "Bagarre", need: { pat: 2 }, reward: 3_000, work: [180, 360], weight: 2 },
  // Mixte
  { id: "accident", label: "Accident de la circulation", need: { pat: 1, amb: 1 }, reward: 4_000, work: [240, 480], weight: 3 },
  { id: "incarc", label: "Accident avec personne incarcérée", need: { tp: 1, vsr: 1, amb: 1, pat: 1 }, reward: 10_000, work: [420, 900], weight: 1 },
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
export const MAX_OPEN_INCIDENTS = 25;
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

// Besoins restants une fois comptés les véhicules donnés (types exacts d'abord, puis remplaçants)
export function remainingNeeds(need, types) {
  const rem = { ...need };
  const left = [];
  for (const t of types) {
    if (rem[t] > 0) rem[t]--;
    else left.push(t);
  }
  for (const t of left) {
    const k = Object.keys(rem).find((k) => rem[k] > 0 && ALTERNATES[k]?.includes(t));
    if (k) rem[k]--;
  }
  return Object.fromEntries(Object.entries(rem).filter(([, n]) => n > 0));
}

export function isUseful(need, type) {
  return need[type] > 0 || Object.keys(need).some((k) => ALTERNATES[k]?.includes(type));
}

const countNeeds = (need) => Object.values(need).reduce((a, b) => a + b, 0);

function assignedVehicles(state, incident, filter = () => true) {
  return incident.assigned.map((id) => state.vehicles.find((v) => v.id === id)).filter((v) => v && filter(v));
}

// Besoins pas encore couverts (sur place + en route)
export function missingUnits(state, incident) {
  return remainingNeeds(incidentType(incident.typeId).need, assignedVehicles(state, incident).map((v) => v.type));
}

// Besoins pas encore couverts par les véhicules arrivés sur place
export function missingOnScene(state, incident) {
  const onScene = assignedVehicles(state, incident, (v) => v.status === "place");
  return remainingNeeds(incidentType(incident.typeId).need, onScene.map((v) => v.type));
}

export function requirementsMetOnScene(state, incident) {
  return !Object.keys(missingOnScene(state, incident)).length;
}

// Part des besoins couverts sur place (0..1)
export function coverageOnScene(state, incident) {
  const need = incidentType(incident.typeId).need;
  return 1 - countNeeds(missingOnScene(state, incident)) / countNeeds(need);
}

// Plus aucun véhicule en approche : on travaille avec ce qu'on a
export function nobodyEnRoute(state, incident) {
  return !assignedVehicles(state, incident, (v) => v.status === "alerte" || v.status === "route").length;
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
