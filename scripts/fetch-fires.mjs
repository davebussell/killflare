#!/usr/bin/env node
// Pulls near-real-time active-fire detections and writes a static GeoJSON
// snapshot to public/live/fires.geojson (+ a small meta.json alongside it).
//
// Sources:
//   Canada  — CWFIS (Canadian Wildland Fire Information System) WFS,
//             layer "public:hotspots" (last 24h VIIRS/MODIS hotspots).
//             Public, no key required.
//   US      — NASA FIRMS Area API, VIIRS_SNPP_NRT + VIIRS_NOAA20_NRT,
//             bounding box covering CONUS, Alaska & Hawaii.
//             Free, but requires a MAP_KEY (env var FIRMS_MAP_KEY).
//             Get one at https://firms.modaps.eosdis.nasa.gov/api/map_key/
//
// This script never throws on a source being unreachable or missing a key —
// it degrades to whatever sources it *can* reach, so a bad network day or a
// missing key locally never breaks `npm run build`.

import { writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = process.env.LIVE_OUT_DIR || path.join(__dirname, '..', 'public', 'live');
const OUT_FILE = path.join(OUT_DIR, 'fires.geojson');
const META_FILE = path.join(OUT_DIR, 'meta.json');

const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || '';
// CONUS + Alaska + Hawaii, west,south,east,north
const US_BBOX = '-179.5,18,-65,72';
const FIRMS_SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT'];
const FIRMS_DAY_RANGE = 1;

const CWFIS_WFS =
  'https://cwfis.cfs.nrcan.gc.ca/geoserver/wfs' +
  '?service=WFS&version=2.0.0&request=GetFeature' +
  '&typeNames=public:hotspots&outputFormat=application/json&srsName=EPSG:4326';

async function fetchText(url, { timeoutMs = 25000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

function parseCsv(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(',');
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i]));
    return row;
  });
}

async function fetchCwfisHotspots() {
  try {
    const text = await fetchText(CWFIS_WFS);
    const gj = JSON.parse(text);
    const features = (gj.features || []).map((f) => {
      const p = f.properties || {};
      const [lon, lat] = f.geometry?.coordinates || [null, null];
      return {
        type: 'Feature',
        geometry: f.geometry,
        properties: {
          source: 'cwfis',
          country: 'CA',
          sensor: p.sensor || p.satellite || 'hotspot',
          lat,
          lon,
          acq_date: p.rep_date || p.hs_date || p.acq_date || null,
          frp: p.frp ?? null,
          confidence: p.est_area ? `est. area ${p.est_area} ha` : null,
          agency: p.agency || null,
        },
      };
    });
    return features;
  } catch (err) {
    console.error('[fetch-fires] CWFIS fetch failed:', err.message);
    return [];
  }
}

async function fetchFirmsSource(source) {
  if (!FIRMS_MAP_KEY) return [];
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_MAP_KEY}/${source}/${US_BBOX}/${FIRMS_DAY_RANGE}`;
  try {
    const text = await fetchText(url);
    if (/invalid/i.test(text.slice(0, 200))) {
      console.error(`[fetch-fires] FIRMS ${source} rejected the request (bad MAP_KEY or quota):`, text.slice(0, 200));
      return [];
    }
    const rows = parseCsv(text);
    return rows
      .filter((r) => r.latitude && r.longitude)
      .map((r) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [Number(r.longitude), Number(r.latitude)] },
        properties: {
          source: 'firms',
          sensor: source,
          country: 'US',
          lat: Number(r.latitude),
          lon: Number(r.longitude),
          acq_date: r.acq_date || null,
          acq_time: r.acq_time || null,
          frp: r.frp ? Number(r.frp) : null,
          confidence: r.confidence ?? null,
          daynight: r.daynight || null,
        },
      }));
  } catch (err) {
    console.error(`[fetch-fires] FIRMS ${source} fetch failed:`, err.message);
    return [];
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const [cwfis, ...firms] = await Promise.all([
    fetchCwfisHotspots(),
    ...FIRMS_SOURCES.map(fetchFirmsSource),
  ]);
  const firmsFeatures = firms.flat();

  const features = [...cwfis, ...firmsFeatures];

  const geojson = { type: 'FeatureCollection', features };
  await writeFile(OUT_FILE, JSON.stringify(geojson));

  const meta = {
    generatedAt: new Date().toISOString(),
    counts: {
      total: features.length,
      canada: cwfis.length,
      us: firmsFeatures.length,
    },
    firmsKeyPresent: Boolean(FIRMS_MAP_KEY),
  };
  await writeFile(META_FILE, JSON.stringify(meta, null, 2));

  console.log(`[fetch-fires] wrote ${features.length} features (CA: ${cwfis.length}, US: ${firmsFeatures.length}) — FIRMS key present: ${meta.firmsKeyPresent}`);
}

main().catch((err) => {
  console.error('[fetch-fires] unexpected failure, writing empty snapshot:', err);
  return mkdir(OUT_DIR, { recursive: true })
    .then(() => writeFile(OUT_FILE, JSON.stringify({ type: 'FeatureCollection', features: [] })))
    .then(() => writeFile(META_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), counts: { total: 0, canada: 0, us: 0 }, firmsKeyPresent: Boolean(FIRMS_MAP_KEY), error: String(err) }, null, 2)));
});
