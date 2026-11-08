import { CANTONS, difficulty, startingBudget } from "./cantons.js";
import { pointInGeometry, areaKm2, haversineKm, randomPointIn, inverseMask, distToSegmentsKm, sharedSegments } from "./geo.js";
import { route, snapToRoad } from "./routing.js";
import * as G from "./game.js";

const $panel = document.getElementById("panel");
const $hud = document.getElementById("hud");
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// =====================================================================
// Carte
// =====================================================================
const map = L.map("map", { minZoom: 7, maxZoom: 19, zoomSnap: 0.25 }).setView([46.8, 8.23], 8);
const swisstopo = (layer, ext, maxNativeZoom) =>
  L.tileLayer(
    `https://wmts.geo.admin.ch/1.0.0/${layer}/default/current/3857/{z}/{x}/{y}.${ext}`,
    { maxNativeZoom, maxZoom: 19, attribution: '© <a href="https://www.swisstopo.admin.ch/">swisstopo</a>' },
  );
const baseLayers = {
  "Carte nationale (swisstopo)": swisstopo("ch.swisstopo.pixelkarte-farbe", "jpeg", 18),
  "Carte grise (swisstopo)": swisstopo("ch.swisstopo.pixelkarte-grau", "jpeg", 18),
  "Photo aérienne (swisstopo)": swisstopo("ch.swisstopo.swissimage", "jpeg", 19),
  OpenStreetMap: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }),
};
baseLayers["Carte nationale (swisstopo)"].addTo(map);
// Prévient si le fond de carte ne charge pas (pas d'internet, bloqueur, page ouverte en file://…)
let tilesOk = 0, tilesKo = 0, tileWarned = false;
for (const layer of Object.values(baseLayers)) {
  layer.on("tileload", () => tilesOk++);
  layer.on("tileerror", () => {
    if (++tilesKo > 12 && !tilesOk && !tileWarned) {
      tileWarned = true;
      toast("Le fond de carte ne se charge pas : vérifie ta connexion, ou essaie la couche OpenStreetMap (bouton en haut à gauche).", "warn");
    }
  });
}
L.control.layers(baseLayers, null, { position: "topleft" }).addTo(map);
map.attributionControl.addAttribution(
  'Frontières : OFS GEOSTAT · Itinéraires : <a href="https://project-osrm.org/">OSRM</a> / OpenStreetMap',
);

const [cantonsFC, lakesFC, communes, countryFC] = await Promise.all(
  ["data/cantons.geojson", "data/lakes.geojson", "data/communes.json", "data/country.geojson"].map((u) =>
    fetch(u).then((r) => r.json()),
  ),
);
const lakeGeoms = lakesFC.features.map((f) => f.geometry);
const cantonById = new Map(cantonsFC.features.map((f) => [f.id, f]));
const inLake = (pt) => lakeGeoms.some((g) => pointInGeometry(pt, g));

// =====================================================================
// Phase 1 : choix du canton
// =====================================================================
let selectLayer = null;
let selectedCanton = null;

const cantonStyle = (id) => ({
  color: "#1b1f24",
  weight: id === selectedCanton ? 3 : 1.2,
  fillColor: "#e3262f",
  fillOpacity: id === selectedCanton ? 0.45 : 0.12,
});

function startSelect() {
  $hud.hidden = true;
  selectLayer = L.geoJSON(cantonsFC, {
    style: (f) => cantonStyle(f.id),
    onEachFeature: (f, layer) => {
      const c = CANTONS[f.id];
      layer.bindTooltip(`${c.name} (${c.abbr})`, { sticky: true, className: "canton-tip" });
      layer.on({
        mouseover: () => layer.setStyle({ fillOpacity: Math.max(0.3, cantonStyle(f.id).fillOpacity) }),
        mouseout: () => layer.setStyle(cantonStyle(f.id)),
        click: () => selectCanton(f.id),
      });
    },
  }).addTo(map);
  map.fitBounds(selectLayer.getBounds());
  map.setMaxBounds(selectLayer.getBounds().pad(0.3));
  renderSelectIntro();
}

function renderSelectIntro() {
  const items = Object.entries(CANTONS)
    .sort((a, b) => a[1].name.localeCompare(b[1].name, "fr"))
    .map(([id, c]) => {
      const d = difficulty(c.pop);
      const border = sharedSegments(cantonById.get(Number(id)).geometry, countryFC.features[0].geometry).length > 0;
      return `<button class="item" data-action="select-canton" data-id="${id}">
        <span class="badge abbr">${c.abbr}</span>
        <span class="grow"><span class="title">${esc(c.name)}</span>
        <span class="sub">${c.pop.toLocaleString("fr-CH")} hab. · ${esc(c.capital)}${border ? " · 🛃 frontière" : ""}</span></span>
        <span class="stars" title="${d.label}">${"★".repeat(d.stars)}</span>
      </button>`;
    })
    .join("");
  $panel.innerHTML = `<div class="pbody">
    <h2>Choisis ton canton</h2>
    <p class="muted">Tu prends la direction de la centrale d'engagement d'un canton :
    construis tes casernes, achète tes véhicules et réponds aux appels 118 · 144 · 117
    sur le vrai réseau routier suisse.</p>
    <div class="hint">Clique sur un canton de la carte ou dans la liste.</div>
    <div class="list">${items}</div></div>`;
}

function selectCanton(id) {
  id = Number(id);
  selectedCanton = id;
  selectLayer.eachLayer((l) => l.setStyle(cantonStyle(l.feature.id)));
  const f = cantonById.get(id);
  const c = CANTONS[id];
  const d = difficulty(c.pop);
  const nCommunes = communes.filter((x) => x.canton === id).length;
  map.flyToBounds(L.geoJSON(f).getBounds(), { padding: [30, 30], duration: 0.6 });
  const border = sharedSegments(f.geometry, countryFC.features[0].geometry).length > 0;
  $panel.innerHTML = `<div class="pbody">
    <button class="btn sm" data-action="select-back">← Tous les cantons</button>
    <h2 style="margin-top:12px">${esc(c.name)} <span class="badge">${c.abbr}</span></h2>
    <div class="muted">Chef-lieu : ${esc(c.capital)} · Langue : ${c.lang}</div>
    <div class="grid2">
      <div class="stat"><b>${c.pop.toLocaleString("fr-CH")}</b><span>habitants (env.)</span></div>
      <div class="stat"><b>${Math.round(areaKm2(f.geometry)).toLocaleString("fr-CH")} km²</b><span>superficie</span></div>
      <div class="stat"><b>${nCommunes}</b><span>communes</span></div>
      <div class="stat"><b class="stars">${"★".repeat(d.stars)}</b><span>${d.label}</span></div>
    </div>
    <div class="stat" style="margin-bottom:10px"><b>${G.formatMoney(startingBudget(c.pop))}</b><span>budget de départ</span></div>
    <div class="hint" style="border-left-color:${G.CATEGORIES.customs.color}">${border ? "🛃 Canton frontalier : tu pourras construire des postes de douane." : "Pas de frontière nationale : pas de douane dans ce canton."}</div>
    <button class="btn primary block" data-action="claim" data-id="${id}">Revendiquer le canton ${esc(articleCanton(c.name))}</button></div>`;
}

function articleCanton(name) {
  return /^[AEIOUYÂÉÈ]/i.test(name) ? `d'${name}` : `de ${name}`;
}

function claim(id) {
  id = Number(id);
  const c = CANTONS[id];
  state = G.newGame(id, startingBudget(c.pop));
  G.save(state);
  selectLayer.remove();
  selectLayer = null;
  startPlay();
  toast(`Canton ${articleCanton(c.name)} revendiqué ! Commence par construire ta centrale d’engagement 📡.`, "ok");
}

// =====================================================================
// Phase 2 : gestion du canton
// =====================================================================
let state = null;
let canton, cantonGeom, cantonCommunes;
const layers = {
  routes: L.layerGroup(),
  stations: L.layerGroup(),
  incidents: L.layerGroup(),
  vehicles: L.layerGroup(),
};
const markers = { stations: new Map(), vehicles: new Map(), incidents: new Map(), routes: new Map(), zones: new Map() };
const ui = {
  tab: "interventions", view: null, build: null, speed: 3, checked: null, checkedFor: null,
  filter: { inc: "all", veh: "all" }, othersOpen: false, patrolPick: null,
};
let borderSegs = []; // tronçons de frontière nationale du canton
let borderLayer = null;

const vehicle = (id) => state.vehicles.find((v) => v.id === id);
const station = (id) => state.stations.find((s) => s.id === id);
const incident = (id) => state.incidents.find((i) => i.id === id);
const category = (v) => G.VEHICLE_TYPES[v.type].category;
const catColor = (cat) => G.STATION_TYPES[cat].color;

function startPlay() {
  canton = CANTONS[state.cantonId];
  const f = cantonById.get(state.cantonId);
  cantonGeom = f.geometry;
  cantonCommunes = communes.filter((c) => c.canton === state.cantonId);

  L.geoJSON(inverseMask(cantonGeom), {
    interactive: false,
    style: { stroke: false, fillColor: "#0b0e12", fillOpacity: 0.55 },
  }).addTo(map);
  const outline = L.geoJSON(f, { interactive: false, style: { color: "#e3262f", weight: 3, fill: false } }).addTo(map);
  for (const l of Object.values(layers)) l.addTo(map);

  // frontière terrestre uniquement (on ignore les tronçons au milieu des lacs)
  borderSegs = sharedSegments(cantonGeom, countryFC.features[0].geometry).filter(
    ([a, b]) => !inLake([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]),
  );
  borderLayer = L.layerGroup([
    L.polyline(borderSegs.map(([a, b]) => [[a[1], a[0]], [b[1], b[0]]]), {
      color: G.CATEGORIES.customs.color, weight: 18, opacity: 0.35, interactive: false, lineCap: "round",
    }),
    L.polyline(borderSegs.map(([a, b]) => [[a[1], a[0]], [b[1], b[0]]]), {
      color: "#b2f2bb", weight: 2, dashArray: "6 6", interactive: false,
    }),
  ]);

  const b = outline.getBounds();
  map.setMaxBounds(null);
  map.fitBounds(b, { padding: [20, 20] });
  map.setMinZoom(Math.max(7, map.getBoundsZoom(b) - 1.5));
  map.setMaxBounds(b.pad(0.6));

  for (const s of state.stations) addStationMarker(s);
  if (state.central) addCentralMarker();
  for (const v of state.vehicles) if (v.patrol) { drawPatrolZone(v); patrolLeg(v); }
  for (const i of state.incidents) addIncidentMarker(i);

  $hud.hidden = false;
  document.getElementById("hud-canton").textContent = `${canton.abbr} · ${canton.name}`;
  setSpeed(ui.speed);
  renderPanel();
  requestAnimationFrame(tick);
}

// ---------- Marqueurs ----------
function addStationMarker(s) {
  const t = G.STATION_TYPES[s.type];
  const m = L.marker([s.pos[1], s.pos[0]], {
    icon: L.divIcon({
      className: "",
      html: `<div class="mk mk-station" style="--c:${t.color}">${t.icon}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
    }),
    zIndexOffset: 100,
  })
    .bindTooltip(esc(s.name))
    .on("click", () => openView({ kind: "station", id: s.id }))
    .addTo(layers.stations);
  markers.stations.set(s.id, m);
}

function incidentIcon(i) {
  return L.divIcon({
    className: "",
    html: `<div class="mk mk-incident ${STATUS_INC[i.status].cls}" style="--c:${catOf(i).color}"><span>${catOf(i).icon}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function addIncidentMarker(i) {
  const m = L.marker([i.pt[1], i.pt[0]], { icon: incidentIcon(i), zIndexOffset: 500 })
    .bindTooltip(() => `<b>${esc(G.incidentType(i.typeId).label)}</b><br><span class="small">${esc(i.address)} · ${STATUS_INC[i.status].label}</span>`)
    .on("click", () => openView({ kind: "incident", id: i.id }))
    .addTo(layers.incidents);
  markers.incidents.set(i.id, m);
}

function refreshIncidentMarker(i) {
  markers.incidents.get(i.id)?.setIcon(incidentIcon(i));
}

function refreshVehicleMarker(v) {
  let m = markers.vehicles.get(v.id);
  if (v.status === "dispo") {
    if (m) layers.vehicles.removeLayer(m);
    markers.vehicles.delete(v.id);
    return;
  }
  const icon = L.divIcon({
    className: "",
    html: `<div class="mk mk-vehicle ${v.status === "route" ? "moving" : ""}" style="--c:${catColor(category(v))}">${G.VEHICLE_TYPES[v.type].short}</div>`,
    iconSize: [34, 16],
    iconAnchor: [17, 8],
  });
  if (!m) {
    m = L.marker([v.pos[1], v.pos[0]], { icon, zIndexOffset: 1000 })
      .bindTooltip(() => `${esc(v.name)} · ${G.STATUS_LABEL[v.status]}`)
      .on("click", () => v.incidentId && openView({ kind: "incident", id: v.incidentId }))
      .addTo(layers.vehicles);
    markers.vehicles.set(v.id, m);
  } else m.setIcon(icon);
}

function setRouteLine(v) {
  clearRouteLine(v);
  if (!v.trip) return;
  const line = L.polyline(v.trip.coords, {
    color: catColor(category(v)),
    weight: 4,
    opacity: v.trip.kind === "incident" ? 0.8 : 0.45,
    dashArray: v.trip.kind === "incident" ? null : "6 8",
    interactive: false,
  }).addTo(layers.routes);
  markers.routes.set(v.id, line);
}

function clearRouteLine(v) {
  const l = markers.routes.get(v.id);
  if (l) layers.routes.removeLayer(l);
  markers.routes.delete(v.id);
}

// ---------- Construction ----------
function setBuild(type) {
  ui.build = ui.build === type ? null : type;
  ui.patrolPick = null;
  document.body.classList.toggle("map-building", !!ui.build);
  if (borderLayer) {
    if (ui.build && G.STATION_TYPES[ui.build]?.borderOnly && borderSegs.length) {
      borderLayer.addTo(map);
      map.flyToBounds(L.latLngBounds(borderSegs.flat().map(([x, y]) => [y, x])).pad(0.15), { duration: 0.6 });
    } else borderLayer.remove();
  }
  renderPanel();
}

function nearestCommune(pt) {
  let best = cantonCommunes[0], bestD = Infinity;
  for (const c of cantonCommunes) {
    const d = haversineKm(pt, c.c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

map.on("click", async (e) => {
  if (!state) return;
  const pt = [e.latlng.lng, e.latlng.lat];
  if (ui.patrolPick) return pickPatrolZone(pt);
  if (!ui.build) return;
  const typeId = ui.build;
  if (!pointInGeometry(pt, cantonGeom)) return toast("Ce point est hors de ton canton.", "warn");
  if (inLake(pt)) return toast("Difficile de construire dans le lac…", "warn");
  if (typeId === "central") return buildCentral(pt);
  const t = G.STATION_TYPES[typeId];
  if (state.money < t.cost) return toast("Budget insuffisant.", "warn");
  if (t.borderOnly && distToSegmentsKm(pt, borderSegs) > G.BORDER_KM)
    return toast(`Un ${t.label.toLowerCase()} doit être à moins de ${G.BORDER_KM} km de la frontière nationale (zone verte).`, "warn");
  setBuild(null);

  // On place la caserne sur la route la plus proche pour que les départs soient propres.
  const snap = await snapToRoad(pt);
  const pos = snap.distanceM < 400 && pointInGeometry(snap.pt, cantonGeom) ? snap.pt : pt;
  const place = nearestCommune(pos).name;
  let name = `${t.prefix} ${place}`;
  const same = state.stations.filter((s) => s.name.startsWith(name)).length;
  if (same) name += ` ${same + 1}`;

  state.money -= t.cost;
  const s = { id: G.uid(state, "S"), type: typeId, name, place, pos };
  state.stations.push(s);
  addStationMarker(s);
  addVehicle(s, t.starter);
  if (state.nextSpawnAt == null) state.nextSpawnAt = state.time + 45;
  G.save(state);
  if (!state.central) toast("📡 Sans centrale d'engagement, aucun appel ne peut être reçu.", "warn");
  toast(`${t.icon} ${name} construit(e) (−${G.formatMoney(t.cost)}).`, "ok", { cat: typeId });
  renderPanel();
});

// ---------- Centrale d'engagement ----------
async function buildCentral(pt) {
  const cost = G.CENTRAL.levels[0].cost;
  if (state.central) return toast("Tu as déjà une centrale.", "warn");
  if (state.money < cost) return toast("Budget insuffisant.", "warn");
  setBuild(null);
  const snap = await snapToRoad(pt);
  const pos = snap.distanceM < 400 && pointInGeometry(snap.pt, cantonGeom) ? snap.pt : pt;
  state.money -= cost;
  state.central = { pos, name: `Centrale ${nearestCommune(pos).name}`, level: 0 };
  addCentralMarker();
  if (state.nextSpawnAt == null || state.nextSpawnAt < state.time) state.nextSpawnAt = state.time + 45;
  G.save(state);
  toast(`📡 ${state.central.name} opérationnelle : les appels peuvent arriver !`, "ok");
  if (!state.stations.length) toast("Construis maintenant une caserne, une base ou un poste pour répondre aux appels.");
  renderPanel();
}

function upgradeCentral() {
  const next = G.CENTRAL.levels[state.central.level + 1];
  if (!next) return;
  if (state.money < next.cost) return toast("Budget insuffisant.", "warn");
  state.money -= next.cost;
  state.central.level++;
  G.save(state);
  toast(`📡 Centrale améliorée : ${next.label} (${next.maxCalls} appels simultanés).`, "ok");
  renderPanel();
}

const maxCalls = () => (state.central ? Math.min(G.MAX_OPEN_INCIDENTS, G.CENTRAL.levels[state.central.level].maxCalls) : 0);

let centralMarker = null;
function addCentralMarker() {
  centralMarker?.remove();
  const c = state.central;
  centralMarker = L.marker([c.pos[1], c.pos[0]], {
    icon: L.divIcon({
      className: "",
      html: `<div class="mk mk-central" style="--c:${G.CENTRAL.color}">${G.CENTRAL.icon}</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
    zIndexOffset: 200,
  })
    .bindTooltip(() => esc(state.central.name))
    .on("click", () => openView({ kind: "central" }))
    .addTo(layers.stations);
}

// ---------- Patrouilles ----------
function startPatrolPick(vid) {
  ui.patrolPick = vid;
  ui.build = null;
  document.body.classList.add("map-building");
  toast(`🚓 Clique sur la carte pour choisir la zone de patrouille de ${vehicle(vid).name} (Échap pour annuler).`);
  renderPanel();
}

function cancelPatrolPick() {
  ui.patrolPick = null;
  document.body.classList.remove("map-building");
  renderPanel();
}

function pickPatrolZone(pt) {
  if (!pointInGeometry(pt, cantonGeom)) return toast("Zone hors de ton canton.", "warn");
  const v = vehicle(ui.patrolPick);
  cancelPatrolPick();
  if (!v || !(v.status === "dispo" || v.status === "retour" || v.status === "patrouille")) return;
  startPatrol(v, pt);
}

function startPatrol(v, center) {
  v.patrol = { center };
  drawPatrolZone(v);
  toast(`🚓 ${v.name} part en patrouille.`, "", { cat: category(v) });
  patrolLeg(v);
}

function drawPatrolZone(v) {
  markers.zones.get(v.id)?.remove();
  if (!v.patrol) return markers.zones.delete(v.id);
  const [lon, lat] = v.patrol.center;
  markers.zones.set(
    v.id,
    L.circle([lat, lon], {
      radius: G.PATROL_RADIUS_KM * 1000, color: catColor(category(v)), weight: 1.5,
      dashArray: "4 6", fillOpacity: 0.06, interactive: false,
    }).addTo(layers.routes),
  );
}

// Prochaine étape : un point au hasard dans la zone (sur la terre ferme, dans le canton)
function patrolLeg(v) {
  const [lon, lat] = v.patrol.center;
  let dest = null;
  for (let k = 0; k < 30 && !dest; k++) {
    const r = G.PATROL_RADIUS_KM * Math.sqrt(Math.random());
    const a = Math.random() * 2 * Math.PI;
    const cand = [lon + (r * Math.cos(a)) / (111.32 * Math.cos((lat * Math.PI) / 180)), lat + (r * Math.sin(a)) / 110.57];
    if (pointInGeometry(cand, cantonGeom) && !inLake(cand)) dest = cand;
  }
  v.status = "patrouille";
  refreshVehicleMarker(v);
  driveTo(v, dest ?? v.patrol.center, "patrol");
}

function endPatrol(v) {
  v.patrol = null;
  drawPatrolZone(v);
}

// Une patrouille peut tomber sur une infraction : intervention immédiate sur place
function patrolDiscovery(v) {
  const t = G.pickIncidentType(new Set([category(v)]), state, (t) =>
    Object.keys(t.need).length === 1 && t.need[v.type] === 1,
  );
  if (!t || state.incidents.length >= G.MAX_OPEN_INCIDENTS) return;
  v.trip = null;
  v.tripToken = ++tripSeq;
  clearRouteLine(v);
  const i = {
    id: G.uid(state, "I"), typeId: t.id, pt: v.pos.slice(), address: nearestCommune(v.pos).name,
    createdAt: state.time, status: "engage", assigned: [v.id], workEnd: null, found: true,
  };
  v.status = "place";
  v.incidentId = i.id;
  state.incidents.push(i);
  addIncidentMarker(i);
  refreshVehicleMarker(v);
  toast(`👁️ ${v.name} a constaté : ${t.label} (flagrant délit, prime +${Math.round((G.PATROL_BONUS - 1) * 100)} %)`, "call", { incident: i.id, cat: t.cat });
  snapToRoad(i.pt).then((r) => {
    if (r.street) i.address = `${r.street}, ${i.address}`;
    dirty = true;
  });
  dirty = true;
}

function addVehicle(s, vtype) {
  const vt = G.VEHICLE_TYPES[vtype];
  const n = state.vehicles.filter((v) => v.stationId === s.id && v.type === vtype).length + 1;
  const v = {
    id: G.uid(state, "V"),
    type: vtype,
    stationId: s.id,
    name: `${vt.short} ${s.place}${n > 1 ? " " + n : ""}`,
    status: "dispo",
    pos: s.pos.slice(),
    incidentId: null,
  };
  state.vehicles.push(v);
  return v;
}

function buyVehicle(stationId, vtype) {
  const s = station(stationId);
  const vt = G.VEHICLE_TYPES[vtype];
  const count = state.vehicles.filter((v) => v.stationId === s.id).length;
  if (count >= G.STATION_TYPES[s.type].capacity) return toast("Caserne pleine.", "warn");
  if (state.money < vt.cost) return toast("Budget insuffisant.", "warn");
  state.money -= vt.cost;
  const v = addVehicle(s, vtype);
  G.save(state);
  toast(`${v.name} acheté(e).`, "ok");
  renderPanel();
}

// ---------- Déplacements ----------
let tripSeq = 0;

async function driveTo(v, dest, kind) {
  const token = ++tripSeq;
  v.tripToken = token;
  const r = await route(v.pos, dest);
  if (!state || v.tripToken !== token) return; // annulé entre-temps
  const cum = [0];
  for (let k = 1; k < r.coords.length; k++) {
    const [la1, lo1] = r.coords[k - 1];
    const [la2, lo2] = r.coords[k];
    cum.push(cum[k - 1] + haversineKm([lo1, la1], [lo2, la2]));
  }
  v.trip = {
    kind,
    coords: r.coords,
    cum,
    total: Math.max(cum[cum.length - 1], 1e-6),
    start: state.time,
    // urgence = plus rapide, patrouille = plus lent ; la météo ralentit tout le monde
    dur: Math.max(20, (r.durationS * (kind === "incident" ? G.URGENT_FACTOR : kind === "patrol" ? 1.2 : 1)) / (G.WEATHER[state.weather?.id]?.drive ?? 1)),
    dest,
    offline: r.offline,
  };
  v.status = { incident: "route", station: "retour", patrol: "patrouille" }[kind];
  if (r.offline) toast("Serveur d'itinéraires injoignable : trajet estimé en ligne droite.", "warn");
  setRouteLine(v);
  refreshVehicleMarker(v);
  dirty = true;
}

function positionOnTrip(trip, frac) {
  const d = frac * trip.total;
  const { cum, coords } = trip;
  let lo = 0, hi = cum.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= d) lo = mid; else hi = mid;
  }
  const seg = cum[hi] - cum[lo] || 1;
  const t = Math.min(1, Math.max(0, (d - cum[lo]) / seg));
  const [la1, lo1] = coords[lo];
  const [la2, lo2] = coords[hi];
  return [lo1 + (lo2 - lo1) * t, la1 + (la2 - la1) * t]; // [lon, lat]
}

function sendHome(v) {
  const s = station(v.stationId);
  v.incidentId = null;
  if (v.patrol) return patrolLeg(v); // après une intervention, la patrouille reprend
  if (haversineKm(v.pos, s.pos) < 0.03) {
    v.trip = null;
    v.tripToken = ++tripSeq;
    v.status = "dispo";
    v.pos = s.pos.slice();
    clearRouteLine(v);
    refreshVehicleMarker(v);
    dirty = true;
    return;
  }
  v.status = "retour";
  refreshVehicleMarker(v);
  driveTo(v, s.pos, "station");
}

function arrive(v) {
  const trip = v.trip;
  v.trip = null;
  v.pos = trip.dest.slice();
  clearRouteLine(v);
  if (trip.kind === "patrol") return patrolLeg(v);
  if (trip.kind === "incident") {
    const i = incident(v.incidentId);
    if (!i) return sendHome(v);
    v.status = "place";
  } else {
    v.status = "dispo";
    v.pos = station(v.stationId).pos.slice();
  }
  refreshVehicleMarker(v);
  dirty = true;
}

// ---------- Interventions ----------
function dispatch(i, ids) {
  let n = 0;
  for (const vid of ids) {
    const v = vehicle(vid);
    if (!v || v.incidentId === i.id) continue;
    // Véhicule engagé ailleurs : on le désengage de son intervention et on le redirige
    if (v.incidentId) detach(v);
    v.status = "alerte";
    v.incidentId = i.id;
    v.trip = null;
    clearRouteLine(v);
    i.assigned.push(v.id);
    refreshVehicleMarker(v);
    driveTo(v, i.pt, "incident");
    n++;
  }
  if (n && i.status === "nouveau") {
    i.status = "engage";
    refreshIncidentMarker(i);
  }
  ui.checked = null;
  if (n) toast(`🚨 ${n} véhicule${n > 1 ? "s" : ""} alarmé${n > 1 ? "s" : ""} : ${G.incidentType(i.typeId).label}`, "", { cat: G.incidentType(i.typeId).cat });
  dirty = true;
}

// Retire un véhicule de son intervention (sans le déplacer)
function detach(v) {
  const i = v.incidentId && incident(v.incidentId);
  v.incidentId = null;
  if (i) {
    i.assigned = i.assigned.filter((x) => x !== v.id);
    if (!i.assigned.length && i.status === "engage") {
      i.status = "nouveau";
      i.waitingSince = state.time;
    }
    if (i.status === "travail") {
      const cov = G.coverageOnScene(state, i);
      if (cov <= 0) {
        i.status = i.assigned.length ? "engage" : "nouveau";
        i.waitingSince = state.time;
        i.workEnd = null;
      } else i.coverage = Math.min(i.coverage ?? 1, cov);
    }
    refreshIncidentMarker(i);
  }
}

function recall(vid) {
  const v = vehicle(vid);
  endPatrol(v);
  detach(v);
  sendHome(v);
}

function removeIncident(i) {
  state.incidents = state.incidents.filter((x) => x !== i);
  const m = markers.incidents.get(i.id);
  if (m) layers.incidents.removeLayer(m);
  markers.incidents.delete(i.id);
  if (ui.view?.kind === "incident" && ui.view.id === i.id) ui.view = null;
  dirty = true;
}

function startWork(i, coverage) {
  const t = G.incidentType(i.typeId);
  i.status = "travail";
  i.coverage = coverage;
  i.workStart = state.time;
  // ex. moitié des moyens -> 2× plus long
  i.workEnd = state.time + G.rand(t.work) * (1 + (1 - coverage) * 2);
  refreshIncidentMarker(i);
  if (coverage < 1) toast(`⚠ ${t.label} : intervention avec moyens insuffisants (plus lente, récompense réduite).`, "warn");
  dirty = true;
}

function completeIncident(i) {
  const t = G.incidentType(i.typeId);
  const coverage = i.coverage ?? 1;
  const reward = Math.round((t.reward * (0.4 + 0.6 * coverage) * (i.found ? G.PATROL_BONUS : 1)) / 100) * 100;
  state.money += reward;
  state.stats.done++;
  state.stats.earned += reward;
  for (const vid of i.assigned) {
    const v = vehicle(vid);
    if (v && v.incidentId === i.id) sendHome(v);
  }
  removeIncident(i);
  toast(`✔ ${t.label} (${i.address}) terminé : +${G.formatMoney(reward)}`, "ok", { cat: t.cat });
  G.save(state);
}

let spawning = false;
async function spawnIncident() {
  // Sans centrale, personne ne décroche ; sa taille limite les appels traités en même temps
  if (spawning || !state.central) return;
  if (state.incidents.filter((i) => !i.found).length >= maxCalls()) return;
  // Pas de nouvel appel si tout le monde est occupé : au plus 1 appel en attente
  // de plus que le nombre de véhicules libres (disponibles, en retour ou en patrouille).
  const free = state.vehicles.filter((v) => G.FREE_STATUSES.has(v.status)).length;
  const waiting = state.incidents.filter((i) => i.status === "nouveau").length;
  if (waiting >= free + 1) return;
  const type = G.pickIncidentType(new Set(state.stations.map((s) => s.type)), state);
  if (!type) return;
  spawning = true;
  try {
    // On part d'une commune au hasard (les appels viennent surtout des localités)
    const cats = new Set(Object.keys(type.need).map((v) => G.VEHICLE_TYPES[v].category));
    const bases = state.stations.filter((s) => cats.has(s.type));
    const near = cantonCommunes.filter((c) => bases.some((s) => haversineKm(c.c, s.pos) < G.COVER_KM));
    const pool = near.length ? near : cantonCommunes;
    let pt = null;
    if (type.cat === "customs" && borderSegs.length) {
      // Appels douaniers : le long de la frontière, près d'un poste de douane
      const segs = borderSegs.filter(([a]) => bases.some((s) => haversineKm(a, s.pos) < G.COVER_KM));
      const pool2 = segs.length ? segs : borderSegs;
      for (let k = 0; k < 40 && !pt; k++) {
        const [a, b] = pool2[Math.floor(Math.random() * pool2.length)];
        const f = Math.random();
        const cand = [a[0] + (b[0] - a[0]) * f + (Math.random() - 0.5) * 0.03, a[1] + (b[1] - a[1]) * f + (Math.random() - 0.5) * 0.02];
        if (pointInGeometry(cand, cantonGeom) && !inLake(cand) && distToSegmentsKm(cand, borderSegs) < G.BORDER_KM) pt = cand;
      }
    }
    for (let k = 0; k < 25 && !pt; k++) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      const cand = [c.c[0] + (Math.random() - 0.5) * 0.016, c.c[1] + (Math.random() - 0.5) * 0.011];
      if (pointInGeometry(cand, cantonGeom) && !inLake(cand)) pt = cand;
    }
    pt ??= randomPointIn(cantonGeom, lakeGeoms);
    if (!pt) return;
    const snap = await snapToRoad(pt);
    if (!state) return;
    if (pointInGeometry(snap.pt, cantonGeom)) pt = snap.pt;
    const commune = nearestCommune(pt).name;
    const i = {
      id: G.uid(state, "I"),
      typeId: type.id,
      pt,
      address: snap.street ? `${snap.street}, ${commune}` : commune,
      createdAt: state.time,
      status: "nouveau",
      assigned: [],
      workEnd: null,
    };
    state.incidents.push(i);
    addIncidentMarker(i);
    toast(`📞 ${type.label} — ${i.address}`, "call", { incident: i.id, cat: type.cat });
    dirty = true;
  } finally {
    spawning = false;
  }
}

// ---------- Boucle de jeu ----------
let dirty = true;
let last = performance.now();
let lastUi = 0;
let lastSave = 0;

function step(dt) {
  // Météo
  if (!state.weather || state.time >= state.weather.until) {
    const prev = state.weather?.id;
    state.weather = G.nextWeather(state, prev);
    const w = G.WEATHER[state.weather.id];
    if (prev) toast(`${w.icon} Météo : ${w.label}${w.desc ? ` — ${w.desc}` : ""}`, "warn");
  }

  // Patrouilles : chance de tomber sur une infraction
  for (const v of state.vehicles)
    if (v.status === "patrouille" && Math.random() < dt / G.PATROL_DISCOVERY) patrolDiscovery(v);

  for (const v of state.vehicles) {
    if (!v.trip) continue;
    const frac = (state.time - v.trip.start) / v.trip.dur;
    if (frac >= 1) arrive(v);
    else {
      v.pos = positionOnTrip(v.trip, frac);
      markers.vehicles.get(v.id)?.setLatLng([v.pos[1], v.pos[0]]);
    }
  }

  for (const i of [...state.incidents]) {
    const t = G.incidentType(i.typeId);
    if (i.status === "engage" && G.requirementsMetOnScene(state, i)) {
      startWork(i, 1);
    } else if (i.status === "engage" && G.nobodyEnRoute(state, i) && G.coverageOnScene(state, i) > 0) {
      // Moyens insuffisants mais plus personne en approche : on travaille quand même,
      // plus lentement et pour une récompense réduite (l'appel ne bloque plus la partie).
      startWork(i, G.coverageOnScene(state, i));
    } else if (i.status === "travail" && i.coverage < 1 && G.requirementsMetOnScene(state, i)) {
      // Les renforts sont arrivés : on repasse en régime normal
      i.coverage = 1;
      i.workEnd = Math.min(i.workEnd, state.time + G.rand(t.work) * 0.5);
      refreshIncidentMarker(i);
      dirty = true;
    } else if (i.status === "travail" && state.time >= i.workEnd) {
      completeIncident(i);
    } else if (i.status === "nouveau" && state.time - (i.waitingSince ?? i.createdAt) > G.UNATTENDED_TIMEOUT) {
      state.stats.missed++;
      toast(`✖ Appel sans réponse : ${G.incidentType(i.typeId).label} (${i.address})`, "warn");
      removeIncident(i);
    }
  }

  if (state.central && state.stations.length && state.nextSpawnAt != null && state.time >= state.nextSpawnAt) {
    state.nextSpawnAt = state.time + G.spawnInterval(canton.pop, G.callRate(state));
    spawnIncident();
  }
}

function tick(now) {
  if (!state) return;
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  if (ui.speed > 0) {
    state.time += dt * ui.speed;
    step(dt * ui.speed);
  }
  if (dirty) {
    dirty = false;
    renderPanel();
  }
  if (now - lastUi > 300) {
    lastUi = now;
    updateHud();
    updateLive();
  }
  if (now - lastSave > 10_000) {
    lastSave = now;
    G.save(state);
  }
  requestAnimationFrame(tick);
}

function setSpeed(s) {
  ui.speed = s;
  document.querySelectorAll(".speed button").forEach((b) => b.classList.toggle("on", Number(b.dataset.speed) === s));
}
document.querySelector(".speed").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-speed]");
  if (b) setSpeed(Number(b.dataset.speed));
});

let shownMoney = null;
function updateHud() {
  const $m = document.getElementById("hud-money");
  if (shownMoney != null && state.money !== shownMoney) {
    $m.classList.remove("up", "down");
    void $m.offsetWidth; // relance l'animation
    $m.classList.add(state.money > shownMoney ? "up" : "down");
  }
  shownMoney = state.money;
  $m.textContent = G.formatMoney(state.money);
  const night = G.isNight(state.time);
  const $c = document.getElementById("hud-clock");
  $c.textContent = `${night ? "🌙" : "☀️"} ${G.formatClock(state.time)}`;
  $c.title = `Jour ${G.dayNumber(state.time)}`;
  const w = G.WEATHER[state.weather.id];
  const $w = document.getElementById("hud-weather");
  $w.textContent = `${night && w.night ? w.night : w.icon} ${G.temperature(state)}°C`;
  $w.title = `${w.label}${w.desc ? " — " + w.desc : ""}\nTrajets : ${w.drive < 1 ? `ralentis (×${(1 / w.drive).toFixed(2)})` : "normaux"} · Appels : ×${G.callRate(state).toFixed(2)}`;
  $w.dataset.w = state.weather.id;
  // La carte s'assombrit la nuit
  const d = G.daylight(state.time);
  document.documentElement.style.setProperty("--daylight", d.toFixed(3));
  document.body.classList.toggle("night", d < 0.5);
}


// =====================================================================
// Panneau latéral
// =====================================================================
const STATUS_INC = {
  nouveau: { label: "Nouveau", cls: "s-new" },
  engage: { label: "Moyens engagés", cls: "s-eng" },
  travail: { label: "En cours", cls: "s-work" },
};
const catOf = (i) => G.CATEGORIES[G.incidentType(i.typeId).cat];
const kChf = (n) => (n >= 1000 ? `${Math.round(n / 100) / 10}k` : String(n));

function openView(view) {
  ui.view = view;
  ui.scroll = 0;
  if (view?.kind === "incident") {
    const i = incident(view.id);
    if (i) map.panTo([i.pt[1], i.pt[0]]);
  }
  if (view?.kind === "central" && state.central) map.panTo([state.central.pos[1], state.central.pos[0]]);
  if (view?.kind === "station") {
    const s = station(view.id);
    if (s) map.panTo([s.pos[1], s.pos[0]]);
  }
  renderPanel(true);
}

// Redessine le panneau en conservant la position de défilement
function renderPanel(resetScroll = false) {
  if (!state) return;
  const scroll = resetScroll ? 0 : $panel.scrollTop;
  let html;
  if (ui.view?.kind === "incident" && incident(ui.view.id)) html = viewIncident(incident(ui.view.id));
  else if (ui.view?.kind === "station" && station(ui.view.id)) html = viewStation(station(ui.view.id));
  else if (ui.view?.kind === "central" && state.central) html = viewCentral();
  else {
    ui.view = null;
    html = viewTabs();
  }
  $panel.innerHTML = html;
  $panel.scrollTop = scroll;
  updateLive();
}

function viewTabs() {
  const open = state.incidents.length;
  const waiting = state.incidents.filter((i) => i.status === "nouveau").length;
  const free = state.vehicles.filter((v) => G.FREE_STATUSES.has(v.status)).length;
  const rate = state.stats.done + state.stats.missed
    ? Math.round((100 * state.stats.done) / (state.stats.done + state.stats.missed))
    : 100;
  const tabs = [
    ["interventions", "📞", "Appels", open ? `<span class="count ${waiting ? "hot" : ""}">${open}</span>` : ""],
    ["vehicules", "🚨", "Unités", ""],
    ["construire", "🏗️", "Construire", ""],
  ];
  const body = { interventions: tabIncidents, vehicules: tabVehicles, construire: tabBuild }[ui.tab]();
  return `
    <div class="phead">
      <div class="kpis">
        <div class="kpi"><b>${open}<small>/${maxCalls()}</small></b><span>appels ouverts</span></div>
        <div class="kpi"><b>${free}<small>/${state.vehicles.length}</small></b><span>unités dispo</span></div>
        <div class="kpi"><b>${rate}<small>%</small></b><span>réussite</span></div>
      </div>
      <nav class="tabs">${tabs
        .map(
          ([id, ico, label, extra]) =>
            `<button data-action="tab" data-id="${id}" class="${ui.tab === id ? "on" : ""}"><span>${ico}</span>${label}${extra}</button>`,
        )
        .join("")}</nav>
    </div>
    ${ui.patrolPick ? `<div class="hint pulse" style="margin:10px 14px 0">🚓 Clique sur la carte pour choisir la zone de patrouille de <b>${esc(vehicle(ui.patrolPick)?.name ?? "")}</b>. <kbd>Échap</kbd> pour annuler.</div>` : ""}
    <div class="pbody">${body}</div>`;
}

function filterChips(kind, cats, counts) {
  const cur = ui.filter[kind];
  const chip = (id, label, color, n) =>
    `<button class="chip ${cur === id ? "on" : ""}" data-action="filter" data-kind="${kind}" data-id="${id}" style="--c:${color}">
      ${id !== "all" ? `<i></i>` : ""}${label}${n != null ? ` <small>${n}</small>` : ""}</button>`;
  return `<div class="chips">${chip("all", "Tous", "var(--muted)")}${cats
    .map((c) => chip(c, `${G.CATEGORIES[c].icon} ${G.CATEGORIES[c].label}`, G.CATEGORIES[c].color, counts[c]))
    .join("")}</div>`;
}

function unitDots(i) {
  return i.assigned
    .map(vehicle)
    .filter(Boolean)
    .map((v) => `<span class="udot u-${v.status}" title="${esc(v.name)} · ${G.STATUS_LABEL[v.status]}">${G.VEHICLE_TYPES[v.type].short}</span>`)
    .join("");
}

function tabIncidents() {
  if (!state.central)
    return `<div class="empty">
        <div class="big">📡</div>
        <b>Aucune centrale d'engagement</b>
        <p>Sans centrale, personne ne décroche le téléphone : construis-la en premier pour recevoir les appels 112 · 117 · 118 · 144.</p>
        <button class="btn primary" data-action="tab" data-id="construire">Construire la centrale</button>
      </div>`;
  if (!state.stations.length)
    return `<div class="empty">
        <div class="big">🏗️</div>
        <b>Aucun bâtiment pour l'instant</b>
        <p>Construis ta première caserne dans ton canton pour recevoir des appels.</p>
        <button class="btn primary" data-action="tab" data-id="construire">Construire</button>
      </div>`;
  if (!state.incidents.length)
    return `<div class="empty"><div class="big">☕</div><b>Calme plat…</b><p>Les appels arrivent au fil du temps.</p></div>`;

  const counts = {};
  for (const i of state.incidents) counts[G.incidentType(i.typeId).cat] = (counts[G.incidentType(i.typeId).cat] ?? 0) + 1;
  const cats = Object.keys(G.CATEGORIES).filter((c) => counts[c]);
  if (ui.filter.inc !== "all" && !counts[ui.filter.inc]) ui.filter.inc = "all";
  const order = { nouveau: 0, engage: 1, travail: 2 };
  const list = state.incidents
    .filter((i) => ui.filter.inc === "all" || G.incidentType(i.typeId).cat === ui.filter.inc)
    .sort((a, b) => order[a.status] - order[b.status] || b.createdAt - a.createdAt);

  return `${cats.length > 1 ? filterChips("inc", cats, counts) : ""}
    <div class="list">${list
      .map((i) => {
        const t = G.incidentType(i.typeId);
        const c = catOf(i);
        const st = STATUS_INC[i.status];
        return `<button class="card inc ${st.cls}" style="--c:${c.color}" data-action="open-incident" data-id="${i.id}" data-hover="inc:${i.id}">
          <span class="ico">${c.icon}</span>
          <span class="grow">
            <span class="title">${esc(t.label)}</span>
            <span class="sub">📍 ${esc(i.address)}</span>
            <span class="meta"><span class="pill ${st.cls}">${st.label}</span><span class="muted" data-age="${i.id}"></span>${unitDots(i)}</span>
            ${i.status === "travail" ? `<span class="bar"><i data-progress="${i.id}"></i></span>` : ""}
          </span>
          <span class="reward">+${kChf(t.reward)}</span>
        </button>`;
      })
      .join("")}</div>`;
}

function vehicleRow(v, { recall = true } = {}) {
  const vt = G.VEHICLE_TYPES[v.type];
  const canRecall = recall && ["alerte", "route", "place"].includes(v.status);
  const patrolNote = v.status === "patrouille" ? `Patrouille vers ${esc(nearestCommune(v.patrol?.center ?? v.pos).name)}` : null;
  const inc = v.incidentId && incident(v.incidentId);
  return `<div class="vrow" style="--c:${catColor(vt.category)}" data-hover="veh:${v.id}"
      ${inc ? `data-action="open-incident" data-id="${inc.id}"` : ""}>
    <span class="vbadge">${vt.short}</span>
    <span class="grow">
      <span class="title">${esc(v.name)}</span>
      <span class="sub">${inc ? `→ ${esc(G.incidentType(inc.typeId).label)}` : patrolNote ?? vt.label} ${v.status === "patrouille" ? "" : `<span class="eta" data-eta="${v.id}"></span>`}</span>
    </span>
    <span class="pill v-${v.status}">${G.STATUS_LABEL[v.status]}</span>
    ${G.PATROL_TYPES.has(v.type) && ["dispo", "retour"].includes(v.status) ? `<button class="icon-btn patrol" data-action="patrol" data-id="${v.id}" title="Envoyer en patrouille">🚓</button>` : ""}
    ${canRecall || v.status === "patrouille" ? `<button class="icon-btn" data-action="recall" data-id="${v.id}" title="${v.status === "patrouille" ? "Fin de patrouille, retour au poste" : "Désengager et rentrer en caserne"}">↩</button>` : ""}
  </div>`;
}

function tabVehicles() {
  if (!state.stations.length)
    return `<div class="empty"><div class="big">🚒</div><b>Pas encore d'unités</b><p>Chaque bâtiment construit arrive avec un véhicule.</p></div>`;
  const counts = {};
  for (const s of state.stations) counts[s.type] = (counts[s.type] ?? 0) + state.vehicles.filter((v) => v.stationId === s.id).length;
  const cats = Object.keys(G.CATEGORIES).filter((c) => counts[c]);
  if (ui.filter.veh !== "all" && !counts[ui.filter.veh]) ui.filter.veh = "all";
  const patrolling = state.vehicles.filter((v) => v.status === "patrouille").length;
  const busy = state.vehicles.filter((v) => v.status !== "dispo" && v.status !== "patrouille").length;
  const canPatrol = state.vehicles.some((v) => G.PATROL_TYPES.has(v.type));
  return `
    <div class="summary">
      <span><i class="dotc" style="--c:var(--ok)"></i>${state.vehicles.length - busy - patrolling} disponibles</span>
      <span><i class="dotc" style="--c:#b197fc"></i>${patrolling} en patrouille</span>
      <span><i class="dotc" style="--c:var(--warn)"></i>${busy} en mission</span>
    </div>
    ${canPatrol ? `<div class="tip">🚓 Envoie tes patrouilles (police, douane) sillonner une zone : elles restent alarmables, partent de plus près et peuvent tomber sur des flagrants délits (prime +25 %).</div>` : ""}
    ${cats.length > 1 ? filterChips("veh", cats, counts) : ""}
    ${state.stations
      .filter((s) => ui.filter.veh === "all" || s.type === ui.filter.veh)
      .map((s) => {
        const t = G.STATION_TYPES[s.type];
        const vs = state.vehicles.filter((v) => v.stationId === s.id);
        const free = vs.filter((v) => v.status === "dispo").length;
        return `<section class="group" style="--c:${t.color}">
          <button class="ghead" data-action="open-station" data-id="${s.id}" data-hover="sta:${s.id}">
            <span class="sico">${t.icon}</span>
            <span class="grow"><span class="title">${esc(s.name)}</span><span class="sub">${t.label}</span></span>
            <span class="pill ${free ? "v-dispo" : "v-place"}">${free}/${vs.length} dispo</span>
            <span class="chev">›</span>
          </button>
          <div class="vlist">${vs.map((v) => vehicleRow(v)).join("")}</div>
        </section>`;
      })
      .join("")}`;
}

function centralCard() {
  const C = G.CENTRAL;
  const c = state.central;
  if (!c) {
    const cost = C.levels[0].cost;
    const active = ui.build === "central";
    return `<div class="bcard wide central ${active ? "active" : ""}" style="--c:${C.color}">
      <div class="btop"><span class="bicon">${C.icon}</span><span class="tag">ÉTAPE 1</span></div>
      <div class="btitle">${C.label}</div>
      <div class="bdesc">${C.desc} Traite ${C.levels[0].maxCalls} appels à la fois, améliorable.</div>
      <div class="bfoot"><span class="price">${G.formatMoney(cost)}</span>
        <button class="btn sm ${active ? "warn" : "primary"}" data-action="build" data-id="central" ${state.money < cost && !active ? "disabled" : ""}>${active ? "Annuler" : "Placer"}</button></div>
    </div>`;
  }
  const lvl = C.levels[c.level];
  const next = C.levels[c.level + 1];
  return `<button class="bcard wide central built" style="--c:${C.color}" data-action="open-central">
      <div class="btop"><span class="bicon">${C.icon}</span><span class="tag">Niv. ${c.level + 1}/${C.levels.length}</span></div>
      <div class="btitle">${esc(c.name)}</div>
      <div class="bdesc">${lvl.label} · ${lvl.maxCalls} appels simultanés${next ? ` · prochain niveau : ${next.maxCalls} appels (${G.formatMoney(next.cost)})` : " · niveau maximum"}</div>
    </button>`;
}

function tabBuild() {
  const cards = Object.entries(G.STATION_TYPES)
    .map(([id, t]) => {
      const noBorder = t.borderOnly && !borderSegs.length;
      const noCentral = !state.central;
      const poor = state.money < t.cost;
      const active = ui.build === id;
      const why = noCentral ? "🔒 Construis d'abord ta centrale" : noBorder ? "Pas de frontière nationale dans ce canton" : poor ? `Il manque ${G.formatMoney(t.cost - state.money)}` : "";
      return `<div class="bcard ${active ? "active" : ""} ${noCentral || noBorder || poor ? "locked" : ""}" style="--c:${t.color}">
        <div class="btop"><span class="bicon">${t.icon}</span><span class="tag">${t.phone}</span></div>
        <div class="btitle">${t.label}</div>
        <div class="bdesc">${t.desc}</div>
        ${t.borderOnly ? `<div class="bnote">📍 Frontière nationale uniquement (≤ ${G.BORDER_KM} km)</div>` : ""}
        <div class="bfoot">
          <span class="price">${G.formatMoney(t.cost)}</span>
          <button class="btn sm ${active ? "warn" : "primary"}" data-action="build" data-id="${id}" ${noCentral || noBorder || (poor && !active) ? "disabled" : ""}>
            ${active ? "Annuler" : "Placer"}</button>
        </div>
        ${why ? `<div class="why">${why}</div>` : ""}
      </div>`;
    })
    .join("");
  const s = state.stats;
  return `
    ${ui.build ? `<div class="hint pulse">🖱️ Clique sur la carte, dans ton canton${G.STATION_TYPES[ui.build]?.borderOnly ? ", <b>près de la frontière en vert</b>" : ""}, pour placer : <b>${(G.STATION_TYPES[ui.build] ?? G.CENTRAL).label}</b>. <kbd>Échap</kbd> pour annuler.</div>` : ""}
    <div class="bgrid">${centralCard()}${cards}</div>
    <h3>Bilan</h3>
    <div class="grid2">
      <div class="stat"><b>${state.stations.length}</b><span>bâtiments</span></div>
      <div class="stat"><b>${state.vehicles.length}</b><span>véhicules</span></div>
      <div class="stat"><b>${s.done}</b><span>interventions réussies</span></div>
      <div class="stat"><b>${G.formatMoney(s.earned)}</b><span>gagnés</span></div>
    </div>
    <h3>Mode bac à sable</h3>
    <div class="actions">
      <button class="btn sm" data-action="cheat" data-amount="10000">💰 +10 000</button>
      <button class="btn sm" data-action="cheat" data-amount="100000">💰 +100 000</button>
      <button class="btn sm" data-action="cheat" data-amount="1000000">💰 +1 000 000</button>
    </div>
    <hr />
    <button class="btn sm danger" data-action="reset">Abandonner et changer de canton</button>`;
}

function viewCentral() {
  const C = G.CENTRAL;
  const c = state.central;
  const open = state.incidents.filter((i) => !i.found).length;
  const lvl = C.levels[c.level];
  const levels = C.levels
    .map((l, k) => {
      const done = k <= c.level;
      const isNext = k === c.level + 1;
      return `<div class="lvl ${done ? "done" : ""} ${isNext ? "next" : ""}">
        <span class="lnum">${done ? "✓" : k + 1}</span>
        <span class="grow"><span class="title">${l.label}</span><span class="sub">${l.maxCalls} appels simultanés</span></span>
        ${isNext ? `<button class="btn sm primary" data-action="upgrade-central" ${state.money < l.cost ? "disabled" : ""}>${G.formatMoney(l.cost)}</button>` : done ? "" : `<span class="muted small">${G.formatMoney(l.cost)}</span>`}
      </div>`;
    })
    .join("");
  const w = G.WEATHER[state.weather.id];
  return `
    <div class="banner" style="--c:${C.color}">
      <button class="back" data-action="back">← Retour</button>
      <div class="bn-row"><span class="bn-ico">${C.icon}</span>
        <div><h2>${esc(c.name)}</h2><div class="bn-sub">${C.label} · ${lvl.label}</div></div></div>
      <div class="cap"><span>Appels</span><span class="bar"><i style="width:${Math.min(100, (100 * open) / lvl.maxCalls)}%"></i></span><b>${open}/${lvl.maxCalls}</b></div>
    </div>
    <div class="pbody">
      <h3>Situation</h3>
      <div class="grid2">
        <div class="stat"><b>${G.isNight(state.time) ? "🌙 Nuit" : "☀️ Jour"}</b><span>${G.formatClock(state.time)} · jour ${G.dayNumber(state.time)}</span></div>
        <div class="stat"><b>${w.icon} ${G.temperature(state)}°C</b><span>${w.label}</span></div>
        <div class="stat"><b>×${G.callRate(state).toFixed(2)}</b><span>activité des appels</span></div>
        <div class="stat"><b>${w.drive < 1 ? `−${Math.round((1 - w.drive) * 100)} %` : "normale"}</b><span>vitesse des trajets</span></div>
      </div>
      ${w.desc ? `<div class="hint">${w.icon} ${w.desc}</div>` : ""}
      <h3>Niveaux de la centrale</h3>
      <div class="lvls">${levels}</div>
    </div>`;
}

function viewStation(s) {
  const t = G.STATION_TYPES[s.type];
  const vs = state.vehicles.filter((v) => v.stationId === s.id);
  const full = vs.length >= t.capacity;
  const buy = Object.entries(G.VEHICLE_TYPES)
    .filter(([, vt]) => vt.category === s.type)
    .map(([id, vt]) => {
      const n = vs.filter((v) => v.type === id).length;
      const dis = full || state.money < vt.cost;
      return `<div class="vcard ${dis ? "locked" : ""}">
        <span class="vbadge">${vt.short}</span>
        <div class="vname">${vt.label}</div>
        <div class="vmeta">${n ? `${n} en caserne` : "aucun"}</div>
        <button class="btn sm primary" data-action="buy" data-station="${s.id}" data-id="${id}" ${dis ? "disabled" : ""}>
          ${G.formatMoney(vt.cost)}</button>
      </div>`;
    })
    .join("");
  return `
    <div class="banner" style="--c:${t.color}">
      <button class="back" data-action="back">← Retour</button>
      <div class="bn-row"><span class="bn-ico">${t.icon}</span>
        <div><h2>${esc(s.name)}</h2><div class="bn-sub">${t.label}</div></div></div>
      <div class="cap"><span>Places</span><span class="bar"><i style="width:${(100 * vs.length) / t.capacity}%"></i></span><b>${vs.length}/${t.capacity}</b></div>
    </div>
    <div class="pbody" style="--c:${t.color}">
      <h3>Véhicules</h3>
      <div class="vlist">${vs.map((v) => vehicleRow(v)).join("")}</div>
      <h3>Acheter un véhicule</h3>
      ${full ? `<div class="hint">Caserne pleine : construis un autre bâtiment.</div>` : ""}
      <div class="vgrid">${buy}</div>
    </div>`;
}

function viewIncident(i) {
  const t = G.incidentType(i.typeId);
  const c = catOf(i);
  const st = STATUS_INC[i.status];
  const assigned = i.assigned.map(vehicle).filter(Boolean);
  const missEngaged = G.missingUnits(state, i);
  const missScene = G.missingOnScene(state, i);
  const needs = Object.entries(t.need)
    .map(([type, n]) => {
      const vt = G.VEHICLE_TYPES[type];
      const scene = n - (missScene[type] ?? 0);
      const engaged = n - (missEngaged[type] ?? 0);
      const alt = G.ALTERNATES[type]?.length ? ` <small>ou ${G.ALTERNATES[type].map((a) => G.VEHICLE_TYPES[a].short).join("/")}</small>` : "";
      const state_ = scene >= n ? "ok" : engaged >= n ? "go" : "";
      return `<div class="need ${state_}" style="--c:${catColor(vt.category)}" title="${vt.label}">
        <span class="nbadge">${vt.short}</span>
        <span class="grow">${n}× ${vt.label}${alt}</span>
        <span class="ncount">${scene >= n ? "✓" : `${engaged}/${n}`}</span>
      </div>`;
    })
    .join("");

  // Véhicules disponibles (ou en retour) triés par distance à vol d'oiseau
  const available = state.vehicles
    .filter((v) => G.FREE_STATUSES.has(v.status))
    .map((v) => ({ v, km: haversineKm(v.pos, i.pt) }))
    .sort((a, b) => a.km - b.km);
  // Véhicules engagés sur une autre intervention : on peut les rediriger ici
  const busy = state.vehicles
    .filter((v) => v.incidentId && v.incidentId !== i.id && G.isUseful(t.need, v.type))
    .map((v) => ({ v, km: haversineKm(v.pos, i.pt) }))
    .sort((a, b) => a.km - b.km);

  if (ui.checkedFor !== i.id || !ui.checked) {
    ui.checkedFor = i.id;
    ui.checked = suggest(i, available);
  }
  const ids = new Set([...available, ...busy].map(({ v }) => v.id));
  for (const id of ui.checked) if (!ids.has(id)) ui.checked.delete(id);

  const missingNow = G.missingUnits(state, i);
  const relevant = available.filter(({ v }) => G.isUseful(t.need, v.type));
  const others = available.filter(({ v }) => !G.isUseful(t.need, v.type));
  const uncoverable = G.remainingNeeds(missingNow, available.map(({ v }) => v.type));

  const row = ({ v, km }) => {
    const vt = G.VEHICLE_TYPES[v.type];
    const inc = v.incidentId && incident(v.incidentId);
    return `<label class="pick ${ui.checked.has(v.id) ? "on" : ""}" style="--c:${catColor(vt.category)}" data-hover="veh:${v.id}">
      <input type="checkbox" data-check="${v.id}" ${ui.checked.has(v.id) ? "checked" : ""} />
      <span class="vbadge">${vt.short}</span>
      <span class="grow"><span class="title">${esc(v.name)}</span>
        <span class="sub">${vt.label}${v.status === "retour" ? " · en retour" : ""}${v.status === "patrouille" ? " · 🚓 en patrouille" : ""}${inc ? ` · ${G.STATUS_LABEL[v.status].toLowerCase()} : ${esc(G.incidentType(inc.typeId).label)}` : ""}</span></span>
      <span class="km">${km.toFixed(1)} km</span>
      <span class="tick">✓</span>
    </label>`;
  };

  return `
    <div class="banner" style="--c:${c.color}">
      <button class="back" data-action="back">← Appels</button>
      <div class="bn-row"><span class="bn-ico">${c.icon}</span>
        <div><h2>${esc(t.label)}</h2><div class="bn-sub">📍 ${esc(i.address)}</div></div></div>
      <div class="bn-pills">
        <span class="pill ${st.cls}">${st.label}</span>
        <span class="pill ghost">${c.label}</span>
        <span class="pill ghost" data-age="${i.id}"></span>
        <span class="pill ghost">💰 ${G.formatMoney(t.reward)}</span>
      </div>
      ${
        i.status === "travail"
          ? `<div class="work"><span class="bar"><i data-progress="${i.id}"></i></span><span data-work="${i.id}"></span></div>
             ${i.coverage < 1 ? `<div class="degraded">⚠ Moyens insuffisants (${Math.round(i.coverage * 100)} %) : plus lent, récompense réduite. Envoie des renforts pour accélérer.</div>` : ""}`
          : ""
      }
    </div>
    <div class="pbody">
      <h3>Moyens requis</h3>
      <div class="needs">${needs}</div>
      ${assigned.length ? `<h3>Engagés sur place / en route</h3><div class="vlist">${assigned.map((v) => vehicleRow(v)).join("")}</div>` : ""}
      <div class="h3row"><h3>Disponibles</h3>
        <span><button class="link" data-action="auto" data-id="${i.id}">Proposition auto</button> · <button class="link" data-action="none">Aucun</button></span></div>
      ${
        relevant.length
          ? `<div class="picks">${relevant.map(row).join("")}</div>`
          : `<p class="muted small">Aucun véhicule utile disponible.</p>`
      }
      ${
        others.length
          ? `<details ${ui.othersOpen ? "open" : ""} data-details="others"><summary>Autres véhicules (${others.length})</summary><div class="picks">${others.map(row).join("")}</div></details>`
          : ""
      }
      ${
        busy.length
          ? `<h3>Engagés ailleurs <small>(redirection)</small></h3>
             <p class="small muted" style="margin:-4px 0 8px">Coche un véhicule pour le désengager de son intervention et l'envoyer ici.</p>
             <div class="picks">${busy.map(row).join("")}</div>`
          : ""
      }
      ${
        Object.keys(uncoverable).length
          ? `<div class="hint">Il manque ${Object.entries(uncoverable).map(([type, n]) => `<b>${n}× ${G.VEHICLE_TYPES[type].short}</b>`).join(", ")}.
             Envoie ce que tu as : sur place, tes équipes travailleront quand même (plus lentement, récompense réduite).</div>`
          : ""
      }
    </div>
    <div class="actionbar">
      <button class="btn primary big" data-action="dispatch" data-id="${i.id}" ${ui.checked.size ? "" : "disabled"}>
        🚨 Alarmer <span data-count>${ui.checked.size}</span> véhicule${ui.checked.size > 1 ? "s" : ""}</button>
    </div>`;
}

// Proposition : les plus proches du bon type, puis les remplaçants (ex. TP à la place d'un VPI)
function suggest(i, available) {
  const checked = new Set();
  const chosen = [];
  const left = () => Object.values(G.remainingNeeds(G.missingUnits(state, i), chosen)).reduce((a, b) => a + b, 0);
  const missing = G.missingUnits(state, i);
  for (const { v } of available)
    if (missing[v.type] > 0) {
      missing[v.type]--;
      chosen.push(v.type);
      checked.add(v.id);
    }
  for (const { v } of available) {
    if (checked.has(v.id) || !left()) continue;
    const before = left();
    chosen.push(v.type);
    if (left() < before) checked.add(v.id);
    else chosen.pop();
  }
  return checked;
}

// Éléments du panneau qui changent en continu (ETA, chronos, progression)
function updateLive() {
  $panel.querySelectorAll("[data-eta]").forEach((el) => {
    const v = vehicle(el.dataset.eta);
    el.textContent = v?.trip ? `· ${G.formatDuration(Math.max(0, v.trip.start + v.trip.dur - state.time))}` : "";
  });
  $panel.querySelectorAll("[data-age]").forEach((el) => {
    const i = incident(el.dataset.age);
    if (i) el.textContent = `⏱ ${G.formatDuration(state.time - i.createdAt)}`;
  });
  $panel.querySelectorAll("[data-work]").forEach((el) => {
    const i = incident(el.dataset.work);
    if (i?.workEnd) el.textContent = `fin dans ${G.formatDuration(Math.max(0, i.workEnd - state.time))}`;
  });
  $panel.querySelectorAll("[data-progress]").forEach((el) => {
    const i = incident(el.dataset.progress);
    if (!i?.workEnd) return;
    const start = i.workStart ?? i.workEnd - 600;
    el.style.width = `${Math.min(100, Math.max(0, (100 * (state.time - start)) / (i.workEnd - start)))}%`;
  });
}

// ---------- Survol : liste ↔ carte ----------
let hovered = null;
function hoverMarker(key, on) {
  const [kind, id] = key.split(":");
  const m = { inc: markers.incidents, veh: markers.vehicles, sta: markers.stations }[kind]?.get(id);
  if (!m) return;
  m.getElement()?.classList.toggle("hl", on);
  if (on) m.openTooltip();
  else m.closeTooltip();
}
$panel.addEventListener("mouseover", (e) => {
  const key = e.target.closest("[data-hover]")?.dataset.hover ?? null;
  if (key === hovered) return;
  if (hovered) hoverMarker(hovered, false);
  hovered = key;
  if (key) hoverMarker(key, true);
});
$panel.addEventListener("mouseleave", () => {
  if (hovered) hoverMarker(hovered, false);
  hovered = null;
});

// ---------- Actions ----------
const actions = {
  "select-canton": (d) => selectCanton(d.id),
  "select-back": () => {
    selectedCanton = null;
    selectLayer.eachLayer((l) => l.setStyle(cantonStyle(l.feature.id)));
    map.flyToBounds(selectLayer.getBounds(), { duration: 0.6 });
    renderSelectIntro();
  },
  claim: (d) => claim(d.id),
  tab: (d) => {
    ui.tab = d.id;
    ui.view = null;
    renderPanel(true);
  },
  filter: (d) => {
    ui.filter[d.kind] = d.id;
    renderPanel();
  },
  back: () => openView(null),
  build: (d) => setBuild(d.id),
  buy: (d) => buyVehicle(d.station, d.id),
  "open-incident": (d) => d.id && openView({ kind: "incident", id: d.id }),
  "open-station": (d) => openView({ kind: "station", id: d.id }),
  dispatch: (d) => {
    const i = incident(d.id);
    if (i) dispatch(i, [...ui.checked]);
  },
  auto: (d) => {
    ui.checked = null;
    renderPanel();
  },
  none: () => {
    ui.checked = new Set();
    renderPanel();
  },
  recall: (d) => recall(d.id),
  patrol: (d) => startPatrolPick(d.id),
  "open-central": () => openView({ kind: "central" }),
  "upgrade-central": () => upgradeCentral(),
  cheat: (d) => {
    state.money += Number(d.amount);
    G.save(state);
    updateHud();
    renderPanel();
    toast(`💰 +${G.formatMoney(Number(d.amount))} ajoutés.`, "ok");
  },
  reset: () => {
    if (!confirm("Abandonner cette partie ? Toute la progression sera perdue.")) return;
    G.wipeSave();
    location.reload();
  },
};

$panel.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !actions[el.dataset.action]) return;
  if (el.closest("label.pick") && !el.matches("button")) return; // laisse la case à cocher gérer
  e.preventDefault();
  e.stopPropagation();
  actions[el.dataset.action](el.dataset, el);
});

$panel.addEventListener("change", (e) => {
  const id = e.target.dataset.check;
  if (!id) return;
  e.target.checked ? ui.checked.add(id) : ui.checked.delete(id);
  e.target.closest(".pick")?.classList.toggle("on", e.target.checked);
  const btn = $panel.querySelector('[data-action="dispatch"]');
  if (btn) {
    btn.disabled = !ui.checked.size;
    btn.innerHTML = `🚨 Alarmer <span data-count>${ui.checked.size}</span> véhicule${ui.checked.size > 1 ? "s" : ""}`;
  }
});

$panel.addEventListener(
  "toggle",
  (e) => {
    if (e.target.dataset?.details === "others") ui.othersOpen = e.target.open;
  },
  true,
);

// Raccourcis clavier : Espace = pause, 1-4 = vitesses, Échap = annuler / retour
let lastSpeed = 3;
document.addEventListener("keydown", (e) => {
  if (!state || e.target.matches("input, textarea")) return;
  if (e.code === "Space") {
    e.preventDefault();
    if (ui.speed) {
      lastSpeed = ui.speed;
      setSpeed(0);
    } else setSpeed(lastSpeed);
  } else if (["Digit1", "Digit2", "Digit3", "Digit4", "Digit5"].includes(e.code)) {
    setSpeed([1, 3, 10, 30, 60][Number(e.code.slice(-1)) - 1]);
  } else if (e.key === "Escape") {
    if (ui.patrolPick) cancelPatrolPick();
    else if (ui.build) setBuild(null);
    else if (ui.view) openView(null);
  }
});

// ---------- Notifications ----------
// opts.incident : rend la notification cliquable (ouvre l'appel) ; opts.cat : couleur du service
function toast(msg, kind = "", opts = {}) {
  const box = document.getElementById("toasts");
  const el = document.createElement(opts.incident ? "button" : "div");
  el.className = `toast ${kind} ${opts.incident ? "clickable" : ""}`;
  if (opts.cat) el.style.setProperty("--c", G.CATEGORIES[opts.cat].color);
  el.textContent = msg;
  if (opts.incident)
    el.addEventListener("click", () => {
      if (incident(opts.incident)) openView({ kind: "incident", id: opts.incident });
      el.remove();
    });
  box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => el.classList.add("out"), 5600);
  setTimeout(() => el.remove(), 6000);
}

// =====================================================================
// Démarrage
// =====================================================================
state = G.load();
if (state && cantonById.has(state.cantonId)) startPlay();
else {
  state = null;
  startSelect();
}
