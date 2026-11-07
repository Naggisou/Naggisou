// Convertit le TopoJSON de swiss-maps (BFS GEOSTAT / swisstopo) en GeoJSON léger
// pour le jeu. Usage :
//   npm pack swiss-maps@4.7.0 && tar xzf swiss-maps-4.7.0.tgz
//   node tools/build-geodata.mjs package/2021 data/
// Source : swiss-maps (BSD-3) — géodonnées « Office fédéral de la statistique (OFS), GEOSTAT ».
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , srcDir, outDir = "data"] = process.argv;
const topo = JSON.parse(readFileSync(join(srcDir, "ch-combined.json"), "utf8"));
const { scale, translate } = topo.transform;

// Décodage des arcs delta-encodés -> coordonnées lon/lat (5 décimales ≈ 1 m)
const round = (v) => Math.round(v * 1e5) / 1e5;
const arcs = topo.arcs.map((arc) => {
  let x = 0, y = 0;
  return arc.map(([dx, dy]) => {
    x += dx; y += dy;
    return [round(x * scale[0] + translate[0]), round(y * scale[1] + translate[1])];
  });
});

function ring(indices) {
  const pts = [];
  for (const i of indices) {
    const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    // évite de dupliquer le point de jonction entre deux arcs
    pts.push(...(pts.length ? a.slice(1) : a));
  }
  return pts;
}

function geometry(g) {
  if (g.type === "Polygon") return { type: "Polygon", coordinates: g.arcs.map(ring) };
  if (g.type === "MultiPolygon")
    return { type: "MultiPolygon", coordinates: g.arcs.map((p) => p.map(ring)) };
  throw new Error("type non géré " + g.type);
}

function collection(name, props = () => ({})) {
  return {
    type: "FeatureCollection",
    features: topo.objects[name].geometries.map((g) => ({
      type: "Feature",
      id: g.id,
      properties: { id: g.id, ...props(g) },
      geometry: geometry(g),
    })),
  };
}

for (const name of ["cantons", "lakes", "country"]) {
  const fc = collection(name);
  const file = join(outDir, `${name}.geojson`);
  writeFileSync(file, JSON.stringify(fc));
  console.log(file, fc.features.length, "entités");
}

// --- Communes : nom + canton (depuis le .dbf) + centroïde (depuis la géométrie) ---
function readDbf(file) {
  const b = readFileSync(file);
  const count = b.readUInt32LE(4), headerLen = b.readUInt16LE(8), recLen = b.readUInt16LE(10);
  const fields = [];
  for (let o = 32; b[o] !== 0x0d; o += 32)
    fields.push({ name: b.toString("latin1", o, o + 11).replace(/\0.*/, ""), len: b[o + 16] });
  const rows = [];
  for (let r = 0, o = headerLen; r < count; r++, o += recLen) {
    let p = o + 1;
    const row = {};
    for (const f of fields) {
      row[f.name] = b.toString("utf8", p, p + f.len).replace(/\0/g, "").trim();
      p += f.len;
    }
    rows.push(row);
  }
  return rows;
}

function centroid(geom) {
  // centroïde surfacique du plus grand anneau extérieur
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
  let best = null, bestA = 0;
  for (const [ring] of polys) {
    let a = 0, cx = 0, cy = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      a += f; cx += (ring[j][0] + ring[i][0]) * f; cy += (ring[j][1] + ring[i][1]) * f;
    }
    if (Math.abs(a) > bestA) { bestA = Math.abs(a); best = [round(cx / (3 * a)), round(cy / (3 * a))]; }
  }
  return best;
}

const names = new Map(readDbf(join(srcDir, "municipalities.dbf")).map((r) => [Number(r.id), r]));
const communes = topo.objects.municipalities.geometries
  .filter((g) => names.has(g.id))
  .map((g) => {
    const r = names.get(g.id);
    return { id: g.id, name: r.name, canton: Number(r.KTNR), c: centroid(geometry(g)) };
  });
writeFileSync(join(outDir, "communes.json"), JSON.stringify(communes));
console.log(join(outDir, "communes.json"), communes.length, "communes");
