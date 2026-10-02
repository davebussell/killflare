#!/usr/bin/env node
// Pulls near-real-time active-fire detections and writes a static GeoJSON
// snapshot to public/live/fires.geojson (+ a small meta.json alongside it).
//
// Sources:
//   Primary — CWFIS (Canadian Wildland Fire Information System) WFS layer
//             "public:hotspots_last24hrs". Despite the name it covers all of
//             North America (the `agency` field is the province or state), so
//             it supplies both Canadian and US detections. Public, no key.
//             (The plain "public:hotspots" layer is season-to-date and far too
//             large — it timed out in CI and the map showed zero fires.)
//   Fallback — NASA FIRMS Area API (VIIRS) for the US, used only if CWFIS
//             returns no US points. Needs a free MAP_KEY (env FIRMS_MAP_KEY).
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
  '&typeNames=public:hotspots_last24hrs&outputFormat=application/json&srsName=EPSG:4326' +
  '&propertyName=geometry,rep_date,sensor,satellite,agency,hfi,estarea';

// Note: agency "CA" is California, not Canada. "MX" (Mexico) and blank
// agencies are dropped — the site covers Canada and the US.
const CA_AGENCIES = new Set(['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'PEI', 'NL', 'YT', 'NT', 'NU', 'PC']);

// 0 = low, 1 = moderate, 2 = high. CWFIS gives head fire intensity (kW/m);
// FIRMS gives fire radiative power (MW). Thresholds are rough display bands.
const levelFromHfi = (h) => (h == null ? 0 : h >= 10000 ? 2 : h >= 2000 ? 1 : 0);
const levelFromFrp = (f) => (f == null ? 0 : f >= 50 ? 2 : f >= 10 ? 1 : 0);
const round = (n, d = 4) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

async function fetchText(url, { timeoutMs = 60000 } = {}) {
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
    const gj = JSON.parse(await fetchText(CWFIS_WFS));
    return (gj.features || [])
      .filter((f) => f.geometry?.type === 'Point' && /^[A-Z]{2,3}$/.test((f.properties?.agency || '').toUpperCase()) && (f.properties.agency || '').toUpperCase() !== 'MX')
      .map((f) => {
        const p = f.properties || {};
        const [lon, lat] = f.geometry.coordinates;
        const agency = (p.agency || '').toUpperCase();
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [round(lon), round(lat)] },
          properties: {
            source: 'cwfis',
            country: CA_AGENCIES.has(agency) ? 'CA' : 'US',
            agency: agency || null,
            sensor: [p.sensor, p.satellite].filter(Boolean).join(' · ') || null,
            detected: p.rep_date || null,
            intensity: p.hfi ?? null,
            area_ha: p.estarea != null ? round(p.estarea, 1) : null,
            level: levelFromHfi(p.hfi),
          },
        };
      });
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
          country: 'US',
          agency: null,
          sensor: source.replace(/_NRT$/, '').replace(/_/g, ' '),
          detected: r.acq_date ? `${r.acq_date}T${String(r.acq_time || '0000').padStart(4, '0').replace(/(\d\d)(\d\d)/, '$1:$2')}:00Z` : null,
          intensity: null,
          area_ha: null,
          frp: r.frp ? Number(r.frp) : null,
          level: levelFromFrp(r.frp ? Number(r.frp) : null),
        },
      }));
  } catch (err) {
    console.error(`[fetch-fires] FIRMS ${source} fetch failed:`, err.message);
    return [];
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const cwfis = await fetchCwfisHotspots();
  const cwfisUs = cwfis.filter((f) => f.properties.country === 'US').length;
  // FIRMS only fills the US if CWFIS had none (avoids double-plotting).
  const firmsFeatures = cwfisUs ? [] : (await Promise.all(FIRMS_SOURCES.map(fetchFirmsSource))).flat();

  const features = [...cwfis, ...firmsFeatures];
  const canada = features.filter((f) => f.properties.country === 'CA').length;

  const geojson = { type: 'FeatureCollection', features };
  await writeFile(OUT_FILE, JSON.stringify(geojson));

  const meta = {
    generatedAt: new Date().toISOString(),
    counts: {
      total: features.length,
      canada,
      us: features.length - canada,
    },
    sources: { cwfis: cwfis.length, firms: firmsFeatures.length },
    firmsKeyPresent: Boolean(FIRMS_MAP_KEY),
  };
  await writeFile(META_FILE, JSON.stringify(meta, null, 2));

  console.log(`[fetch-fires] wrote ${features.length} features (CA: ${canada}, US: ${features.length - canada}; CWFIS ${cwfis.length}, FIRMS ${firmsFeatures.length})`);
}

main().catch((err) => {
  console.error('[fetch-fires] unexpected failure, writing empty snapshot:', err);
  return mkdir(OUT_DIR, { recursive: true })
    .then(() => writeFile(OUT_FILE, JSON.stringify({ type: 'FeatureCollection', features: [] })))
    .then(() => writeFile(META_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), counts: { total: 0, canada: 0, us: 0 }, firmsKeyPresent: Boolean(FIRMS_MAP_KEY), error: String(err) }, null, 2)));
});
