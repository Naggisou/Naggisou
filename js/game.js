// Règles du jeu et état de la partie (sans dépendance à la carte ni au DOM).

// Code couleur par service : utilisé partout (bâtiments, véhicules, appels, menus)
export const CATEGORIES = {
  fire: { label: "Pompiers", color: "#e03131", icon: "🔥" },
  ems: { label: "Sanitaire", color: "#f59f00", icon: "✚" },
  police: { label: "Police", color: "#1c7ed6", icon: "🛡️" },
  customs: { label: "Douane", color: "#2f9e44", icon: "🛃" },
};

export const STATION_TYPES = {
  fire: {
    label: "Caserne de pompiers", prefix: "Caserne", cost: 80_000, icon: "🚒", phone: "118",
    starter: "tp", capacity: 12, desc: "Incendies, inondations, sauvetages, pollutions.",
  },
  ems: {
    label: "Base d'ambulances", prefix: "Base sanitaire", cost: 60_000, icon: "🚑", phone: "144",
    starter: "amb", capacity: 6, desc: "Malaises, chutes, urgences vitales.",
  },
  police: {
    label: "Poste de police", prefix: "Poste de police", cost: 50_000, icon: "🚓", phone: "117",
    starter: "pat", capacity: 6, desc: "Cambriolages, bagarres, accidents.",
  },
  customs: {
    label: "Poste de douane", prefix: "Douane", cost: 70_000, icon: "🛃", phone: "OFDF",
    starter: "dou", capacity: 8, borderOnly: true,
    desc: "Contrebande, contrôles et trafics. Uniquement le long de la frontière nationale.",
  },
};
for (const [id, t] of Object.entries(STATION_TYPES)) t.color = CATEGORIES[id].color;

// Centrale d'engagement : obligatoire pour recevoir des appels.
// Chaque niveau augmente le nombre d'appels traités en même temps.
export const CENTRAL = {
  label: "Centrale d'engagement", icon: "📡", color: "#7950f2",
  desc: "Reçoit les appels 112 · 117 · 118 · 144 et les répartit. À construire en premier.",
  levels: [
    { maxCalls: 4, cost: 50_000, label: "Petite centrale" },
    { maxCalls: 8, cost: 60_000, label: "Centrale régionale" },
    { maxCalls: 14, cost: 120_000, label: "Centrale cantonale" },
    { maxCalls: 25, cost: 250_000, label: "Centrale 112 intégrée" },
  ],
};

// Un poste de douane doit être à moins de BORDER_KM de la frontière nationale
export const BORDER_KM = 2.5;

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
  // Douane (OFDF)
  dou: { label: "Patrouille douanière", short: "DOU", category: "customs", cost: 18_000 },
  cyno: { label: "Équipe cynophile", short: "K9", category: "customs", cost: 22_000 },
  bus: { label: "Bus de contrôle mobile", short: "BUS", category: "customs", cost: 30_000 },
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
  { id: "cambriolage", label: "Cambriolage", need: { pat: 1 }, reward: 1_500, work: [180, 420], weight: 3, time: { night: 1.6 } },
  { id: "bagarre", label: "Bagarre", need: { pat: 2 }, reward: 3_000, work: [180, 360], weight: 2, time: { night: 3 } },
  { id: "tapage", label: "Tapage nocturne", need: { pat: 1 }, reward: 900, work: [120, 300], weight: 1.5, time: { night: 4, day: 0.15 } },
  { id: "vol", label: "Vol à l'étalage", need: { pat: 1 }, reward: 1_100, work: [180, 360], weight: 1.5, time: { night: 0.2 } },
  { id: "controle", label: "Conducteur sous l'influence", need: { pat: 1 }, reward: 1_400, work: [240, 480], weight: 1, time: { night: 2 } },
  // Mixte
  { id: "accident", label: "Accident de la circulation", need: { pat: 1, amb: 1 }, reward: 4_000, work: [240, 480], weight: 3, time: { rush: 1.7, night: 0.6 } },
  { id: "incarc", label: "Accident avec personne incarcérée", need: { tp: 1, vsr: 1, amb: 1, pat: 1 }, reward: 10_000, work: [420, 900], weight: 1, cat: "fire" },
  // Douane (toujours près de la frontière)
  { id: "contrebande", label: "Contrebande de marchandises", need: { dou: 1 }, reward: 2_000, work: [180, 420], weight: 3, time: { night: 1.4 } },
  { id: "franchissement", label: "Franchissement illégal de la frontière", need: { dou: 1 }, reward: 1_800, work: [180, 360], weight: 2, time: { night: 2 } },
  { id: "animaux", label: "Importation illégale d'animaux", need: { dou: 1 }, reward: 2_200, work: [240, 480], weight: 1 },
  { id: "poidslourd", label: "Contrôle d'un poids lourd suspect", need: { dou: 1, bus: 1 }, reward: 4_500, work: [420, 900], weight: 1.5 },
  { id: "armes", label: "Armes non déclarées", need: { dou: 1, cyno: 1 }, reward: 5_000, work: [300, 600], weight: 1 },
  { id: "stups", label: "Trafic de stupéfiants", need: { dou: 1, cyno: 1, pat: 1 }, reward: 8_000, work: [420, 900], weight: 1, cat: "customs" },
  { id: "forcage", label: "Véhicule forçant le passage en douane", need: { dou: 2, pat: 1 }, reward: 7_000, work: [300, 600], weight: 0.8, cat: "customs" },
];
// Service principal de chaque intervention (couleur) : explicite, sinon celui du 1er véhicule requis
for (const t of INCIDENT_TYPES) t.cat ??= VEHICLE_TYPES[Object.keys(t.need)[0]].category;

export const STATUS_LABEL = {
  dispo: "Disponible",
  alerte: "Alerté",
  route: "En route",
  place: "Sur place",
  retour: "Retour",
  patrouille: "En patrouille",
};

// Statuts où un véhicule peut être alarmé directement
export const FREE_STATUSES = new Set(["dispo", "retour", "patrouille"]);

// --- Patrouilles ---
export const PATROL_TYPES = new Set(["pat", "dou"]); // véhicules pouvant patrouiller
export const PATROL_RADIUS_KM = 3;
export const PATROL_DISCOVERY = 25 * 60; // une découverte toutes les ~25 min de jeu par patrouille
export const PATROL_BONUS = 1.25; // récompense majorée pour un flagrant délit

// --- Temps : heure de la journée et météo ---
export const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
// Activité des appels selon l'heure (1 = moyenne)
const HOUR_RATE = [0.45, 0.35, 0.3, 0.3, 0.35, 0.5, 0.8, 1.2, 1.3, 1.1, 1, 1.05,
  1.15, 1.05, 1, 1.05, 1.2, 1.35, 1.3, 1.15, 1, 0.9, 0.75, 0.6];

export const hourOf = (t) => (t % 86400) / 3600;
export const isNight = (t) => { const h = hourOf(t); return h >= 21.5 || h < 6; };
const isRush = (t) => { const h = hourOf(t); return (h >= 7 && h < 9) || (h >= 16.5 && h < 19); };

// Luminosité (0 nuit … 1 jour) pour assombrir la carte
export function daylight(t) {
  const h = hourOf(t);
  if (h >= 8 && h <= 18) return 1;
  if (h >= 21 || h <= 5) return 0;
  return h < 8 ? (h - 5) / 3 : (21 - h) / 3;
}

export const WEATHER = {
  soleil: { label: "Ensoleillé", icon: "☀️", night: "🌙", temp: [10, 24], drive: 1, rate: 1, weight: 3, mult: {} },
  nuageux: { label: "Nuageux", icon: "⛅", night: "☁️", temp: [7, 16], drive: 1, rate: 1, weight: 3, mult: {} },
  pluie: {
    label: "Pluie", icon: "🌧️", temp: [6, 13], drive: 0.9, rate: 1.15, weight: 2,
    desc: "Routes glissantes, caves inondées.", mult: { accident: 1.8, cave: 2.5, inondation: 2, chute: 1.3 },
  },
  orage: {
    label: "Orage", icon: "⛈️", temp: [15, 22], drive: 0.85, rate: 1.4, weight: 0.7,
    desc: "Arbres tombés, inondations, alarmes.", mult: { arbre: 4, inondation: 3, cave: 3, alarme: 2, accident: 1.4 },
  },
  neige: {
    label: "Neige", icon: "❄️", temp: [-6, 1], drive: 0.7, rate: 1.2, weight: 0.8,
    desc: "Trajets ralentis, accidents et chutes.", mult: { accident: 2.2, chute: 2, arbre: 1.5 },
  },
  brouillard: {
    label: "Brouillard", icon: "🌫️", temp: [1, 8], drive: 0.85, rate: 1.05, weight: 1,
    desc: "Visibilité réduite, trajets ralentis.", mult: { accident: 2 },
  },
  canicule: {
    label: "Canicule", icon: "🥵", temp: [27, 35], drive: 1, rate: 1.2, weight: 0.7,
    desc: "Feux de végétation et malaises.", mult: { broussailles: 3.5, foret: 4, malaise: 2.5, acr: 1.5 },
  },
};

export function nextWeather(state, current) {
  const ids = Object.keys(WEATHER).filter((w) => w !== current);
  let r = Math.random() * ids.reduce((a, w) => a + WEATHER[w].weight, 0);
  let id = ids[ids.length - 1];
  for (const w of ids) if ((r -= WEATHER[w].weight) <= 0) { id = w; break; }
  return { id, until: state.time + rand([3, 9]) * 3600 };
}

export function temperature(state) {
  const w = WEATHER[state.weather?.id ?? "soleil"];
  const [lo, hi] = w.temp;
  // plus chaud vers 15h, plus frais vers 5h
  const k = (1 + Math.cos(((hourOf(state.time) - 15) / 24) * 2 * Math.PI)) / 2;
  return Math.round(lo + (hi - lo) * k);
}

// Multiplicateur de fréquence des appels (heure + météo)
export function callRate(state) {
  return HOUR_RATE[Math.floor(hourOf(state.time))] * (WEATHER[state.weather?.id]?.rate ?? 1);
}

function typeWeight(t, state) {
  let w = t.weight * (WEATHER[state.weather?.id]?.mult[t.id] ?? 1);
  if (t.time) {
    if (isNight(state.time)) w *= t.time.night ?? 1;
    else w *= t.time.day ?? 1;
    if (isRush(state.time)) w *= t.time.rush ?? 1;
  }
  return w;
}

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
    central: null,
    weather: { id: "soleil", until: 8 * 3600 + 5 * 3600 },
    stats: { done: 0, missed: 0, earned: 0 },
  };
}

export function uid(state, prefix) {
  return `${prefix}${state.nextId++}`;
}

export function rand([a, b]) {
  return a + Math.random() * (b - a);
}

export function pickIncidentType(categories, state, filter = () => true) {
  const pool = INCIDENT_TYPES.filter(
    (t) => filter(t) && Object.keys(t.need).every((v) => categories.has(VEHICLE_TYPES[v].category)),
  );
  if (!pool.length) return null;
  const weights = pool.map((t) => typeWeight(t, state));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < pool.length; k++) if ((r -= weights[k]) <= 0) return pool[k];
  return pool[pool.length - 1];
}

// Intervalle moyen entre deux appels, en secondes de jeu
export function spawnInterval(pop, rate = 1) {
  const mean = Math.min(600, Math.max(90, 240 * Math.sqrt(300_000 / pop))) / rate;
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
  return `${WEEKDAYS[(day - 1) % 7]} ${hh}:${mm}`;
}

export function dayNumber(t) {
  return Math.floor(t / 86400) + 1;
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
      i.waitingSince = state.time;
    }
    state.central ??= null;
    state.weather ??= { id: "soleil", until: state.time + 4 * 3600 };
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
