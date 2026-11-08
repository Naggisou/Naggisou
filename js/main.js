import { CANTONS, difficulty, startingBudget } from "./cantons.js";
import { pointInGeometry, areaKm2, haversineKm, randomPointIn, inverseMask } from "./geo.js";
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

const [cantonsFC, lakesFC, communes] = await Promise.all(
  ["data/cantons.geojson", "data/lakes.geojson", "data/communes.json"].map((u) =>
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
      return `<button class="item" data-action="select-canton" data-id="${id}">
        <span class="badge">${c.abbr}</span>
        <span class="grow"><span class="title">${esc(c.name)}</span>
        <span class="sub">${c.pop.toLocaleString("fr-CH")} hab. · ${esc(c.capital)}</span></span>
        <span class="stars" title="${d.label}">${"★".repeat(d.stars)}</span>
      </button>`;
    })
    .join("");
  $panel.innerHTML = `
    <h2>Choisis ton canton</h2>
    <p class="muted">Tu prends la direction de la centrale d'engagement d'un canton :
    construis tes casernes, achète tes véhicules et réponds aux appels 118 · 144 · 117
    sur le vrai réseau routier suisse.</p>
    <div class="hint">Clique sur un canton de la carte ou dans la liste.</div>
    <div class="list">${items}</div>`;
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
  $panel.innerHTML = `
    <button class="btn sm" data-action="select-back">← Tous les cantons</button>
    <h2 style="margin-top:12px">${esc(c.name)} <span class="badge">${c.abbr}</span></h2>
    <div class="muted">Chef-lieu : ${esc(c.capital)} · Langue : ${c.lang}</div>
    <div class="grid2">
      <div class="stat"><b>${c.pop.toLocaleString("fr-CH")}</b><span>habitants (env.)</span></div>
      <div class="stat"><b>${Math.round(areaKm2(f.geometry)).toLocaleString("fr-CH")} km²</b><span>superficie</span></div>
      <div class="stat"><b>${nCommunes}</b><span>communes</span></div>
      <div class="stat"><b class="stars">${"★".repeat(d.stars)}</b><span>${d.label}</span></div>
    </div>
    <div class="stat" style="margin-bottom:14px"><b>${G.formatMoney(startingBudget(c.pop))}</b><span>budget de départ</span></div>
    <button class="btn primary block" data-action="claim" data-id="${id}">Revendiquer le canton ${esc(articleCanton(c.name))}</button>`;
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
  toast(`Canton ${articleCanton(c.name)} revendiqué ! Construis ta première caserne.`, "ok");
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
const markers = { stations: new Map(), vehicles: new Map(), incidents: new Map(), routes: new Map() };
const ui = { tab: "interventions", view: null, build: null, speed: 3, checked: null, checkedFor: null };

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

  const b = outline.getBounds();
  map.setMaxBounds(null);
  map.fitBounds(b, { padding: [20, 20] });
  map.setMinZoom(Math.max(7, map.getBoundsZoom(b) - 1.5));
  map.setMaxBounds(b.pad(0.6));

  for (const s of state.stations) addStationMarker(s);
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
      html: `<div class="mk mk-station" style="background:${t.color}">${t.icon}</div>`,
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
    html: `<div class="mk mk-incident ${i.status}">${i.status === "travail" ? "⚙" : "!"}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function addIncidentMarker(i) {
  const m = L.marker([i.pt[1], i.pt[0]], { icon: incidentIcon(i), zIndexOffset: 500 })
    .bindTooltip(() => `${esc(G.incidentType(i.typeId).label)}<br><span class="small">${esc(i.address)}</span>`)
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
    html: `<div class="mk mk-vehicle ${v.status === "route" ? "moving" : ""}" style="background:${catColor(category(v))}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
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
  document.body.classList.toggle("map-building", !!ui.build);
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
  if (!state || !ui.build) return;
  const typeId = ui.build;
  const t = G.STATION_TYPES[typeId];
  const pt = [e.latlng.lng, e.latlng.lat];
  if (!pointInGeometry(pt, cantonGeom)) return toast("Ce point est hors de ton canton.", "warn");
  if (inLake(pt)) return toast("Difficile de construire dans le lac…", "warn");
  if (state.money < t.cost) return toast("Budget insuffisant.", "warn");
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
  toast(`${name} construite (${G.formatMoney(t.cost)}).`, "ok");
  renderPanel();
});

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
    dur: Math.max(20, r.durationS * (kind === "incident" ? G.URGENT_FACTOR : 1)),
    dest,
    offline: r.offline,
  };
  v.status = kind === "incident" ? "route" : "retour";
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
    if (!v || !(v.status === "dispo" || v.status === "retour")) continue;
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
  if (n) toast(`${n} véhicule(s) alarmé(s) pour « ${G.incidentType(i.typeId).label} ».`);
  dirty = true;
}

function recall(vid) {
  const v = vehicle(vid);
  const i = v.incidentId && incident(v.incidentId);
  if (i) {
    i.assigned = i.assigned.filter((x) => x !== vid);
    if (!i.assigned.length && i.status === "engage") i.status = "nouveau";
    if (i.status === "travail") {
      const cov = G.coverageOnScene(state, i);
      if (cov <= 0) {
        i.status = i.assigned.length ? "engage" : "nouveau";
        i.workEnd = null;
      } else i.coverage = Math.min(i.coverage ?? 1, cov);
    }
    refreshIncidentMarker(i);
  }
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
  // ex. moitié des moyens -> 2× plus long
  i.workEnd = state.time + G.rand(t.work) * (1 + (1 - coverage) * 2);
  refreshIncidentMarker(i);
  if (coverage < 1) toast(`⚠ ${t.label} : intervention avec moyens insuffisants (plus lente, récompense réduite).`, "warn");
  dirty = true;
}

function completeIncident(i) {
  const t = G.incidentType(i.typeId);
  const coverage = i.coverage ?? 1;
  const reward = Math.round((t.reward * (0.4 + 0.6 * coverage)) / 100) * 100;
  state.money += reward;
  state.stats.done++;
  state.stats.earned += reward;
  for (const vid of i.assigned) {
    const v = vehicle(vid);
    if (v && v.incidentId === i.id) sendHome(v);
  }
  removeIncident(i);
  toast(`✔ ${t.label} (${i.address}) terminé : +${G.formatMoney(reward)}`, "ok");
  G.save(state);
}

let spawning = false;
async function spawnIncident() {
  if (spawning || state.incidents.length >= G.MAX_OPEN_INCIDENTS) return;
  const type = G.pickIncidentType(new Set(state.stations.map((s) => s.type)));
  if (!type) return;
  spawning = true;
  try {
    // On part d'une commune au hasard (les appels viennent surtout des localités)
    const cats = new Set(Object.keys(type.need).map((v) => G.VEHICLE_TYPES[v].category));
    const bases = state.stations.filter((s) => cats.has(s.type));
    const near = cantonCommunes.filter((c) => bases.some((s) => haversineKm(c.c, s.pos) < G.COVER_KM));
    const pool = near.length ? near : cantonCommunes;
    let pt = null;
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
    toast(`📞 ${type.label} — ${i.address}`);
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

function step() {
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
    } else if (i.status === "nouveau" && state.time - i.createdAt > G.UNATTENDED_TIMEOUT) {
      state.stats.missed++;
      toast(`✖ Appel sans réponse : ${G.incidentType(i.typeId).label} (${i.address})`, "warn");
      removeIncident(i);
    }
  }

  if (state.stations.length && state.nextSpawnAt != null && state.time >= state.nextSpawnAt) {
    state.nextSpawnAt = state.time + G.spawnInterval(canton.pop);
    spawnIncident();
  }
}

function tick(now) {
  if (!state) return;
  const dt = Math.min(0.5, (now - last) / 1000);
  last = now;
  if (ui.speed > 0) {
    state.time += dt * ui.speed;
    step();
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

function updateHud() {
  document.getElementById("hud-money").textContent = G.formatMoney(state.money);
  document.getElementById("hud-clock").textContent = G.formatClock(state.time);
}

// Éléments du panneau qui changent en continu (ETA, chronos) sans tout redessiner
function updateLive() {
  $panel.querySelectorAll("[data-eta]").forEach((el) => {
    const v = vehicle(el.dataset.eta);
    el.textContent = v?.trip ? `${G.formatDuration(Math.max(0, v.trip.start + v.trip.dur - state.time))}` : "";
  });
  $panel.querySelectorAll("[data-age]").forEach((el) => {
    const i = incident(el.dataset.age);
    if (i) el.textContent = `il y a ${G.formatDuration(state.time - i.createdAt)}`;
  });
  $panel.querySelectorAll("[data-work]").forEach((el) => {
    const i = incident(el.dataset.work);
    if (i?.workEnd) el.textContent = `fin estimée dans ${G.formatDuration(Math.max(0, i.workEnd - state.time))}`;
  });
}

// =====================================================================
// Panneau latéral
// =====================================================================
function openView(view) {
  ui.view = view;
  if (view?.kind === "incident") {
    const i = incident(view.id);
    if (i) map.panTo([i.pt[1], i.pt[0]]);
  }
  renderPanel();
}

function renderPanel() {
  if (!state) return;
  if (ui.view?.kind === "incident" && incident(ui.view.id)) return renderIncident(incident(ui.view.id));
  if (ui.view?.kind === "station" && station(ui.view.id)) return renderStation(station(ui.view.id));
  ui.view = null;
  const open = state.incidents.length;
  const tabs = [
    ["interventions", `Interventions${open ? `<span class="count">${open}</span>` : ""}`],
    ["vehicules", "Véhicules"],
    ["construire", "Construire"],
  ];
  const body = { interventions: tabIncidents, vehicules: tabVehicles, construire: tabBuild }[ui.tab]();
  $panel.innerHTML = `
    <div class="tabs">${tabs
      .map(([id, label]) => `<button data-action="tab" data-id="${id}" class="${ui.tab === id ? "on" : ""}">${label}</button>`)
      .join("")}</div>${body}`;
  updateLive();
}

const statusDot = { nouveau: "var(--accent)", engage: "var(--warn)", travail: "var(--ok)" };
const incidentStatusLabel = { nouveau: "Nouveau", engage: "Moyens engagés", travail: "En cours" };

function tabIncidents() {
  if (!state.stations.length)
    return `<div class="hint">Aucune caserne pour l'instant. Va dans l'onglet <b>Construire</b>
      et place ta première caserne dans ton canton.</div>
      <button class="btn primary block" data-action="tab" data-id="construire">Construire</button>`;
  if (!state.incidents.length) return `<p class="muted">Calme plat… pour l'instant. Les appels arrivent au fil du temps.</p>`;
  return `<div class="list">${[...state.incidents]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(
      (i) => `<button class="item" data-action="open-incident" data-id="${i.id}">
        <span class="dot" style="background:${statusDot[i.status]}"></span>
        <span class="grow"><span class="title">${esc(G.incidentType(i.typeId).label)}</span>
        <span class="sub">${esc(i.address)} · <span data-age="${i.id}"></span></span></span>
        <span class="badge ${i.status}">${incidentStatusLabel[i.status]}</span>
      </button>`,
    )
    .join("")}</div>`;
}

function vehicleRow(v, { withRecall = true } = {}) {
  const canRecall = withRecall && ["alerte", "route", "place"].includes(v.status);
  return `<div class="item" data-action="${v.incidentId ? "open-incident" : ""}" data-id="${v.incidentId ?? ""}">
    <span class="dot" style="background:${catColor(category(v))}"></span>
    <span class="grow"><span class="title">${esc(v.name)}</span>
    <span class="sub">${G.VEHICLE_TYPES[v.type].label} <span data-eta="${v.id}"></span></span></span>
    <span class="badge ${v.status}">${G.STATUS_LABEL[v.status]}</span>
    ${canRecall ? `<button class="btn sm" data-action="recall" data-id="${v.id}" title="Retour en caserne">↩</button>` : ""}
  </div>`;
}

function tabVehicles() {
  if (!state.stations.length) return `<p class="muted">Pas encore de véhicules.</p>`;
  return state.stations
    .map(
      (s) => `<h3>${G.STATION_TYPES[s.type].icon} <a href="#" data-action="open-station" data-id="${s.id}" style="color:inherit">${esc(s.name)}</a></h3>
      <div class="list">${state.vehicles.filter((v) => v.stationId === s.id).map((v) => vehicleRow(v)).join("")}</div>`,
    )
    .join("");
}

function tabBuild() {
  const cards = Object.entries(G.STATION_TYPES)
    .map(
      ([id, t]) => `<div class="item" style="cursor:default">
        <span class="mk mk-station" style="background:${t.color}">${t.icon}</span>
        <span class="grow"><span class="title">${t.label}</span>
        <span class="sub">${G.formatMoney(t.cost)} · appels ${t.phone} · inclut 1 ${G.VEHICLE_TYPES[t.starter].label.toLowerCase()}</span></span>
        <button class="btn sm ${ui.build === id ? "active" : ""}" data-action="build" data-id="${id}"
          ${state.money < t.cost ? "disabled" : ""}>${ui.build === id ? "Annuler" : "Placer"}</button>
      </div>`,
    )
    .join("");
  return `
    ${ui.build ? `<div class="hint">Clique sur la carte, à l'intérieur de ton canton, pour placer : <b>${G.STATION_TYPES[ui.build].label}</b>.</div>` : ""}
    <div class="list">${cards}</div>
    <h3>Bilan</h3>
    <div class="grid2">
      <div class="stat"><b>${state.stations.length}</b><span>bâtiments</span></div>
      <div class="stat"><b>${state.vehicles.length}</b><span>véhicules</span></div>
      <div class="stat"><b>${state.stats.done}</b><span>interventions réussies</span></div>
      <div class="stat"><b>${state.stats.missed}</b><span>appels perdus</span></div>
    </div>
    <h3>Mode bac à sable</h3>
    <div class="actions">
      <button class="btn sm" data-action="cheat" data-amount="10000">+10 000 CHF</button>
      <button class="btn sm" data-action="cheat" data-amount="100000">+100 000 CHF</button>
      <button class="btn sm" data-action="cheat" data-amount="1000000">+1 000 000 CHF</button>
    </div>
    <hr />
    <button class="btn sm" data-action="reset">Abandonner et changer de canton</button>`;
}

function renderStation(s) {
  const t = G.STATION_TYPES[s.type];
  const vs = state.vehicles.filter((v) => v.stationId === s.id);
  const buy = Object.entries(G.VEHICLE_TYPES)
    .filter(([, vt]) => vt.category === s.type)
    .map(
      ([id, vt]) => `<div class="item" style="cursor:default">
        <span class="badge">${vt.short}</span>
        <span class="grow"><span class="title">${vt.label}</span>
        <span class="sub">${G.formatMoney(vt.cost)} · ${state.vehicles.filter((v) => v.stationId === s.id && v.type === id).length} en caserne</span></span>
        <button class="btn sm" data-action="buy" data-station="${s.id}" data-id="${id}"
          ${state.money < vt.cost || vs.length >= t.capacity ? "disabled" : ""}>Acheter</button>
      </div>`,
    )
    .join("");
  $panel.innerHTML = `
    <button class="btn sm" data-action="back">← Retour</button>
    <h2 style="margin-top:12px">${t.icon} ${esc(s.name)}</h2>
    <div class="muted">${t.label} · ${vs.length}/${t.capacity} places</div>
    <h3>Véhicules</h3>
    <div class="list">${vs.map((v) => vehicleRow(v)).join("")}</div>
    <h3>Acheter un véhicule</h3>
    ${vs.length >= t.capacity ? `<div class="hint">Caserne pleine : construis-en une autre.</div>` : ""}
    <div class="list">${buy}</div>`;
  updateLive();
}

function renderIncident(i) {
  const t = G.incidentType(i.typeId);
  const assigned = i.assigned.map(vehicle).filter(Boolean);
  const missEngaged = G.missingUnits(state, i);
  const missScene = G.missingOnScene(state, i);
  const needs = Object.entries(t.need)
    .map(([type, n]) => {
      const scene = n - (missScene[type] ?? 0);
      const engaged = n - (missEngaged[type] ?? 0);
      const alt = G.ALTERNATES[type]?.length
        ? ` <span class="muted">(ou ${G.ALTERNATES[type].map((a) => G.VEHICLE_TYPES[a].short).join("/")})</span>`
        : "";
      return `<span class="${scene >= n ? "ok" : ""}">${n}× ${G.VEHICLE_TYPES[type].label}${alt} — ${engaged} engagé(s), ${scene} sur place</span>`;
    })
    .join("");

  // Véhicules disponibles (ou en retour) triés par distance à vol d'oiseau
  const available = state.vehicles
    .filter((v) => v.status === "dispo" || v.status === "retour")
    .map((v) => ({ v, km: haversineKm(v.pos, i.pt) }))
    .sort((a, b) => a.km - b.km);

  // Proposition automatique : les plus proches qui couvrent les besoins manquants
  if (ui.checkedFor !== i.id || !ui.checked) {
    ui.checkedFor = i.id;
    ui.checked = new Set();
    // 1er passage : le bon type de véhicule ; 2e passage : les remplaçants (ex. TP à la place d'un VPI)
    const chosen = [];
    const left = () => Object.values(G.remainingNeeds(G.missingUnits(state, i), chosen)).reduce((a, b) => a + b, 0);
    const missing = G.missingUnits(state, i);
    for (const { v } of available)
      if (missing[v.type] > 0) {
        missing[v.type]--;
        chosen.push(v.type);
        ui.checked.add(v.id);
      }
    for (const { v } of available) {
      if (ui.checked.has(v.id) || !left()) continue;
      const before = left();
      chosen.push(v.type);
      if (left() < before) ui.checked.add(v.id);
      else chosen.pop();
    }
  }

  // retire de la sélection les véhicules partis ailleurs entre-temps
  const availIds = new Set(available.map(({ v }) => v.id));
  for (const id of ui.checked) if (!availIds.has(id)) ui.checked.delete(id);

  const missingNow = G.missingUnits(state, i);
  const relevant = available.filter(({ v }) => G.isUseful(t.need, v.type));
  const others = available.filter(({ v }) => !G.isUseful(t.need, v.type));
  const uncoverable = G.remainingNeeds(missingNow, available.map(({ v }) => v.type));
  const row = ({ v, km }) => `<label class="item check">
      <input type="checkbox" data-check="${v.id}" ${ui.checked.has(v.id) ? "checked" : ""} />
      <span class="dot" style="background:${catColor(category(v))}"></span>
      <span class="grow"><span class="title">${esc(v.name)}</span>
      <span class="sub">${G.VEHICLE_TYPES[v.type].label} · ~${km.toFixed(1)} km${v.status === "retour" ? " · en retour" : ""}</span></span>
    </label>`;

  $panel.innerHTML = `
    <button class="btn sm" data-action="back">← Interventions</button>
    <h2 style="margin-top:12px">${esc(t.label)}</h2>
    <div class="muted">${esc(i.address)} · <span data-age="${i.id}"></span></div>
    <div style="margin-top:8px"><span class="badge ${i.status}">${incidentStatusLabel[i.status]}</span>
      ${i.status === "travail" ? `<span class="small muted" data-work="${i.id}"></span>` : ""}
      ${i.status === "travail" && i.coverage < 1 ? `<div class="small" style="color:var(--warn);margin-top:4px">⚠ Moyens insuffisants (${Math.round(i.coverage * 100)} %) : plus lent, récompense réduite. Envoie des renforts pour accélérer.</div>` : ""}
      <span class="small muted">· récompense ${G.formatMoney(t.reward)}</span></div>
    <h3>Moyens requis</h3>
    <div class="need">${needs}</div>
    ${assigned.length ? `<h3>Engagés</h3><div class="list">${assigned.map((v) => vehicleRow(v)).join("")}</div>` : ""}
    <h3>Disponibles</h3>
    ${
      relevant.length || others.length
        ? `<div class="list">${relevant.map(row).join("")}</div>
           ${others.length ? `<details style="margin-top:8px"><summary class="small muted">Autres véhicules (${others.length})</summary><div class="list" style="margin-top:6px">${others.map(row).join("")}</div></details>` : ""}`
        : `<p class="muted small">Aucun véhicule disponible.</p>`
    }
    ${
      Object.keys(uncoverable).length
        ? `<div class="hint">Il manque ${Object.entries(uncoverable).map(([type, n]) => `${n}× ${G.VEHICLE_TYPES[type].short}`).join(", ")}.
           Envoie ce que tu as : une fois sur place, tes équipes travailleront quand même
           (plus lentement, récompense réduite). Ou achète des véhicules depuis une caserne.</div>`
        : ""
    }
    <div class="actions">
      <button class="btn primary" data-action="dispatch" data-id="${i.id}" ${ui.checked.size ? "" : "disabled"}>
        🚨 Alarmer (${ui.checked.size})</button>
    </div>`;
  updateLive();
}

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
  recall: (d) => recall(d.id),
  cheat: (d) => {
    state.money += Number(d.amount);
    G.save(state);
    updateHud();
    renderPanel();
    toast(`+${G.formatMoney(Number(d.amount))} ajoutés.`, "ok");
  },
  reset: () => {
    if (!confirm("Abandonner cette partie ? Toute la progression sera perdue.")) return;
    G.wipeSave();
    location.reload();
  },
};

$panel.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el || !el.dataset.action || !actions[el.dataset.action]) return;
  if (el.tagName === "A") e.preventDefault();
  e.stopPropagation();
  actions[el.dataset.action](el.dataset, el);
});

$panel.addEventListener("change", (e) => {
  const id = e.target.dataset.check;
  if (!id) return;
  e.target.checked ? ui.checked.add(id) : ui.checked.delete(id);
  const btn = $panel.querySelector('[data-action="dispatch"]');
  if (btn) {
    btn.disabled = !ui.checked.size;
    btn.textContent = `🚨 Alarmer (${ui.checked.size})`;
  }
});

// ---------- Notifications ----------
function toast(msg, kind = "") {
  const box = document.getElementById("toasts");
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.textContent = msg;
  box.appendChild(el);
  while (box.children.length > 5) box.firstChild.remove();
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
