#!/usr/bin/env node
// Fetches official product images for every product with an `asin` in
// src/data/products.json, via Amazon's Creators API (the replacement for
// PA-API 5, which Amazon retired in 2026). Writes a small JSON map:
//
//   { generatedAt, count, items: { <ASIN>: { src, width, height, url } } }
//
// Why this runs in GitHub Actions and not at Netlify build time: Amazon's
// Associates terms require catalog content (images included) to be refreshed
// regularly rather than stored indefinitely. A daily refresh via a Netlify
// rebuild would cost ~450 credits/month; publishing this file to the
// `live-data` branch costs nothing, and the site reads it in the browser.
//
// Credentials (Associates Central -> Tools -> Creators API), as env vars:
//   AMAZON_CREATORS_CREDENTIAL_ID
//   AMAZON_CREATORS_CREDENTIAL_SECRET
//   AMAZON_CREATORS_CREDENTIAL_VERSION   e.g. 2.1 (NA, Cognito) or 3.1 (NA, Login with Amazon)
//   AMAZON_PARTNER_TAG                   defaults to killflare-20
//
// With no credentials it writes an empty map and exits 0 — the site then keeps
// showing its designed placeholder plates. It never fails a build.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_DIR = process.env.LIVE_OUT_DIR || path.join(ROOT, 'public', 'live');
const OUT_FILE = path.join(OUT_DIR, 'amazon-images.json');

const ID = process.env.AMAZON_CREATORS_CREDENTIAL_ID || '';
const SECRET = process.env.AMAZON_CREATORS_CREDENTIAL_SECRET || '';
const VERSION = process.env.AMAZON_CREATORS_CREDENTIAL_VERSION || '2.1';
const PARTNER_TAG = process.env.AMAZON_PARTNER_TAG || 'killflare-20';
const MARKETPLACE = 'www.amazon.com';
const API = 'https://creatorsapi.amazon/catalog/v1/getItems';

const TOKEN_ENDPOINTS = {
  '2.1': 'https://creatorsapi.auth.us-east-1.amazoncognito.com/oauth2/token',
  '3.1': 'https://api.amazon.com/auth/o2/token',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Response casing isn't guaranteed (Items vs items) — read keys case-insensitively.
function pick(obj, ...keys) {
  let cur = obj;
  for (const k of keys) {
    if (!cur || typeof cur !== 'object') return undefined;
    const hit = Object.keys(cur).find((x) => x.toLowerCase() === k.toLowerCase());
    cur = hit === undefined ? undefined : cur[hit];
  }
  return cur;
}

async function getToken() {
  const endpoint = TOKEN_ENDPOINTS[VERSION];
  if (!endpoint) throw new Error(`Unsupported credential version ${VERSION} (expected 2.1 or 3.1 for North America)`);
  const lwa = VERSION.startsWith('3.');
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (lwa) {
    body.set('scope', 'creatorsapi::default');
    headers.Authorization = 'Basic ' + Buffer.from(`${ID}:${SECRET}`).toString('base64');
  } else {
    body.set('scope', 'creatorsapi/default');
    body.set('client_id', ID);
    body.set('client_secret', SECRET);
  }
  const res = await fetch(endpoint, { method: 'POST', headers, body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) throw new Error(`Token request failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  return { token: json.access_token, lwa };
}

async function getItems(asins, { token, lwa }) {
  const res = await fetch(API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-marketplace': MARKETPLACE,
      Authorization: lwa ? `Bearer ${token}` : `Bearer ${token}, Version ${VERSION}`,
    },
    body: JSON.stringify({
      itemIds: asins,
      itemIdType: 'ASIN',
      partnerTag: PARTNER_TAG,
      marketplace: MARKETPLACE,
      resources: ['images.primary.large'],
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`getItems ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  for (const e of pick(json, 'errors') || []) console.warn('[amazon-images] item error:', JSON.stringify(e).slice(0, 200));
  return pick(json, 'itemsResult', 'items') || [];
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const out = { generatedAt: new Date().toISOString(), count: 0, items: {} };

  if (!ID || !SECRET) {
    console.log('[amazon-images] no Creators API credentials — writing empty map (site shows placeholder plates)');
    await writeFile(OUT_FILE, JSON.stringify(out, null, 2));
    return;
  }

  const products = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'products.json'), 'utf8'));
  const asins = [...new Set(products.map((p) => p.asin).filter(Boolean))];

  try {
    const auth = await getToken();
    for (let i = 0; i < asins.length; i += 10) {
      const batch = asins.slice(i, i + 10);
      const items = await getItems(batch, auth);
      for (const it of items) {
        const asin = pick(it, 'asin');
        const large = pick(it, 'images', 'primary', 'large');
        const src = pick(large, 'url');
        if (!asin || !src) continue;
        out.items[asin] = {
          src,
          width: pick(large, 'width') ?? null,
          height: pick(large, 'height') ?? null,
          url: pick(it, 'detailPageURL') || `https://www.amazon.com/dp/${asin}?tag=${PARTNER_TAG}`,
        };
      }
      await sleep(1100); // stay under the default 1 request/second
    }
  } catch (err) {
    console.error('[amazon-images] failed:', err.message);
    out.error = err.message;
  }

  out.count = Object.keys(out.items).length;
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2));
  console.log(`[amazon-images] ${out.count} of ${asins.length} ASINs have images`);
}

main();
