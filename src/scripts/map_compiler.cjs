/**
 * map_compiler.js
 * Compiles RuneApps RS3 maptiles_nxt and maplocations JSON batches into
 * per-region tile color arrays and location manifests for the dashboard.
 *
 * Layering logic (correct RS3 render order):
 *   1. level0 underlay color (hsl16 -> rgb)
 *   2. level0 overlay color (from overlays-*.json, by overlay id)
 *   3. Bridge flag: if level1.flags & 2, that tile at level0 is occluded (roof/bridge)
 *      - we paint it with the level1 data instead (showing the level above)
 *   4. Water: if waterheight is non-null, tint blue
 *
 * Tile grid: 66x66 per mapsquare (64x64 usable + 1-tile bleed border each side)
 *   tile index: z * 66 + x  (where x,z are 0-65)
 *   usable tiles: x=1..64, z=1..64
 *
 * Region ID encoding in filename: maptiles_nxt-5_<regionId>.batch.json
 *   regionId = regionX | (regionZ << 7)   where regionX,Z are mapsquare coords
 *   worldX of tile at local x: regionX * 64 + (x - 1)
 *   worldZ of tile at local z: regionZ * 64 + (z - 1)
 */

'use strict';
const fs = require('fs');
const path = require('path');

const MAP_DIR = 'C:\\Users\\krist\\Downloads\\map';
const OUT_DIR = path.join(process.cwd(), 'src', '3D', 'map');
const GRID = 66;       // 66x66 tile grid per region
const USABLE = 64;     // 64x64 usable tiles (skip border)

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ─── RS3 hsl16 → [r,g,b] ──────────────────────────────────────────────────
function hsl16ToRgb(v) {
  if (!v || v === 0) return [10, 10, 10];
  const h = ((v >> 10) & 0x3f) / 64;
  const s = ((v >> 7) & 0x7) / 8;
  const l = (v & 0x7f) / 128;
  if (s === 0) {
    const c = Math.round(l * 255);
    return [c, c, c];
  }
  function hue(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue(p, q, h + 1/3) * 255),
    Math.round(hue(p, q, h) * 255),
    Math.round(hue(p, q, h - 1/3) * 255)
  ];
}

// ─── Load overlay color tables ─────────────────────────────────────────────
// overlays-<id>.json are individual overlay definitions; id = RS overlay id
// We'll build a map from overlay id (parsed from filename) → [r,g,b]
const overlayColors = {};
fs.readdirSync(MAP_DIR).forEach(file => {
  const m = file.match(/^overlays-(\d+)\.json$/);
  if (!m) return;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(MAP_DIR, file), 'utf8'));
    if (d && Array.isArray(d.color) && d.color.length >= 3) {
      overlayColors[parseInt(m[1], 10)] = [d.color[0], d.color[1], d.color[2]];
    }
  } catch (e) { /* skip bad files */ }
});
console.log('Loaded ' + Object.keys(overlayColors).length + ' overlay color definitions');

// ─── Compile maptiles_nxt → per-region color arrays ───────────────────────
const regionManifest = [];

fs.readdirSync(MAP_DIR).forEach(file => {
  const m = file.match(/^maptiles_nxt-5_(\d+)\.batch\.json$/);
  if (!m) return;

  const regionId = parseInt(m[1], 10);
  // RS3 region encoding: low 7 bits = regionX, high bits = regionZ
  const regionX = regionId & 0x7F;
  const regionZ = (regionId >> 7) & 0x7F;
  const worldOriginX = regionX * 64;
  const worldOriginZ = regionZ * 64;

  let data;
  try {
    data = JSON.parse(fs.readFileSync(path.join(MAP_DIR, file), 'utf8'));
  } catch (e) {
    console.error('Parse error ' + file + ': ' + e.message);
    return;
  }

  if (!data || !data.files || !data.files[0]) return;
  const mapsquare = data.files[0];
  const level0 = mapsquare.level0;
  const level1 = mapsquare.level1;
  if (!level0 || level0.length !== GRID * GRID) return;

  // Build USABLE*USABLE color array [r, g, b] per tile (row-major, z outer)
  const colors = [];
  for (let tz = 0; tz < USABLE; tz++) {
    for (let tx = 0; tx < USABLE; tx++) {
      // Index into 66x66 grid: offset by 1 for the bleed border
      const idx = (tz + 1) * GRID + (tx + 1);
      const tile0 = level0[idx];
      const tile1 = level1 ? level1[idx] : null;

      // Bridge flag: level1.flags & 2 means this tile is under a bridge/roof
      // In that case, render the level1 tile color instead of level0
      const isBridge = tile1 && (tile1.flags & 2) !== 0;
      const srcTile = isBridge ? tile1 : tile0;

      let r = 10, g = 10, b = 10;

      if (srcTile && srcTile.rest) {
        const rest = srcTile.rest;

        // Start with underlay color (hsl16)
        if (rest.underlaycolor) {
          [r, g, b] = hsl16ToRgb(rest.underlaycolor);
        }

        // Layer overlay on top if present
        if (rest.overlay && rest.overlay > 0) {
          const oc = overlayColors[rest.overlay];
          if (oc) {
            // Blend overlay at 70% opacity over underlay
            r = Math.round(r * 0.3 + oc[0] * 0.7);
            g = Math.round(g * 0.3 + oc[1] * 0.7);
            b = Math.round(b * 0.3 + oc[2] * 0.7);
          }
        }

        // Water tint
        if (rest.waterheight !== null && rest.waterheight !== undefined) {
          r = Math.round(r * 0.2 + 10 * 0.8);
          g = Math.round(g * 0.2 + 40 * 0.8);
          b = Math.round(b * 0.2 + 120 * 0.8);
        }
      } else if (srcTile && !srcTile.rest) {
        // No rest data — use height to derive a grey value
        const h = srcTile.height || 0;
        const c = Math.min(255, Math.round((h / 2048) * 200 + 10));
        r = c; g = c; b = c;
      }

      colors.push([r, g, b]);
    }
  }

  regionManifest.push({
    regionId,
    regionX,
    regionZ,
    worldOriginX,
    worldOriginZ,
    width: USABLE,
    height: USABLE,
    colors  // length = 64*64, row-major [r,g,b]
  });
});

console.log('Compiled ' + regionManifest.length + ' regions');

// ─── Write compact manifest (strip colors into flat RGB565 for smaller file) ─
// We store colors as flat Uint8 triples for fast transfer
const compactRegions = regionManifest.map(r => ({
  regionId: r.regionId,
  regionX: r.regionX,
  regionZ: r.regionZ,
  worldOriginX: r.worldOriginX,
  worldOriginZ: r.worldOriginZ,
  width: r.width,
  height: r.height,
  // Flatten to [r,g,b, r,g,b, ...] array
  rgb: r.colors.flat()
}));

fs.writeFileSync(
  path.join(OUT_DIR, 'regions.json'),
  JSON.stringify({ regions: compactRegions })
);
console.log('Written regions.json');

// ─── Compile maplocations ─────────────────────────────────────────────
// Write one file per region: locs_NNNN.json  (NNNN = regionId)
// Also write a region_index.json listing which region files exist.
const locsByRegion = {};

fs.readdirSync(MAP_DIR).forEach(file => {
  if (!file.startsWith('maplocations') || !file.endsWith('.json')) return;
  const match = file.match(/maplocations-5_(\d+)\.batch\.json/);
  if (!match) return;
  try {
    const data = JSON.parse(fs.readFileSync(path.join(MAP_DIR, file), 'utf8'));
    if (!data || !data.files) return;
    const regionId = parseInt(match[1], 10);
    const regionX = regionId & 0x7F;
    const regionZ = (regionId >> 7) & 0x7F;

    if (!locsByRegion[regionId]) locsByRegion[regionId] = [];

    data.files.forEach(f => {
      if (!f || !f.locations) return;
      f.locations.forEach(loc => {
        loc.uses.forEach(use => {
          locsByRegion[regionId].push({
            id: loc.id,
            x: use.x,
            z: use.y,
            plane: use.plane,
            rotation: use.rotation,
            type: use.type
          });
        });
      });
    });
  } catch (err) {
    console.error('Failed to parse ' + file + ': ' + err.message);
  }
});

const locsDir = path.join(OUT_DIR, 'locs');
if (!fs.existsSync(locsDir)) fs.mkdirSync(locsDir, { recursive: true });

const regionIndex = [];
let totalLocs = 0;
Object.entries(locsByRegion).forEach(([rid, locs]) => {
  fs.writeFileSync(path.join(locsDir, 'locs_' + rid + '.json'), JSON.stringify(locs));
  regionIndex.push(parseInt(rid, 10));
  totalLocs += locs.length;
});

fs.writeFileSync(path.join(OUT_DIR, 'region_index.json'), JSON.stringify(regionIndex));
console.log('Compiled ' + totalLocs + ' locations into ' + regionIndex.length + ' per-region files');
