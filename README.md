# killflare.com

Fire protection guide for homes and businesses (Canada + US). Astro static site on Netlify (continuous deploy from `main`).

## Local

    npm install
    npm run dev        # http://localhost:4321
    npm run build      # outputs dist/

## Content

All content is JSON in `src/data/`:

- `categories.json` — 11 gear categories (zone: structure / yard / people), intro + buying notes
- `products.json`   — 28 picks. Each has `links[]` with `kind: "affiliate" | "direct"`
- `guides.json`     — 4 long-form guides; sections can reference product slugs

Pages are generated from these files. Add a product = add an object to `products.json`.

## Images

Two separate systems.

**Editorial photography** — `src/assets/photos/*.jpg`, credited in `src/data/photos.json`.
All from Unsplash under the Unsplash License (free for commercial use). Rendered through
`src/components/Photo.astro`, which uses Astro's `<Image>` for responsive WebP/AVIF output
and stamps a photographer credit. Categories and guides reference a photo by its `photo`
key; the filename matches.

**Product images** — none yet, by design. OEM product shots are the manufacturers' copyright
and are not safe to reuse on a commercial affiliate site. The licensed route is the Amazon
Product Advertising API, which grants image rights to Associates (requires 3 qualifying sales
before API access is granted).

Until then `src/components/ProductImage.astro` renders a designed spec-plate fallback using
the category icon and price band, so cards look intentional rather than broken.

To switch a product to a real image, fill its `image` and `asin` fields in `products.json`:

    "asin": "B08XXXXXXX",
    "image": {
      "src": "https://m.media-amazon.com/images/I/XXXXXXXX._AC_SL1000_.jpg",
      "width": 1000,
      "height": 1000,
      "alt": "WASP gutter sprinkler head clipped to a gutter",
      "credit": "Amazon"
    }

`m.media-amazon.com` and `images-na.ssl-images-amazon.com` are already allowlisted in
`astro.config.mjs`. No component changes needed — `ProductImage` swaps automatically.

## Regions

`src/data/regions.json` — one entry per province and territory (13), each with fire season,
fuel type, area burned for recent seasons, provincial agency and program links, a `priorities`
array of category slugs, and 6–9 authored sections. Rendered by `/regions/` and
`/regions/[slug]`. Figures were checked September 2026 and should be refreshed each spring.


## Contractors

`src/data/contractors.json` (built from research files, Oct 2026):

- `services` — 12 contractor types (sprinklers, alarms, monitoring, extinguishers, kitchen,
  special-hazard, engineering, training, chimney, wildfire, emergency-lighting, firestopping),
  each with what/whoNeeds/standards{CA,US}/frequency/credentials{CA,US}/cost/vet/sources.
- `companies` — every listing verified against the company's own site; `verified` records what
  was checked and when. `regions` uses `CA-BC` / `US-CA` keys (US "CA" is California).
- `regions`, `associations`, `programs` (free wildfire assessment / rebate programs).

Pages: `/contractors/`, `/contractors/<service>/`, `/contractors/in/<region>/`.
Do not add a company without checking its own site and recording it in `verified`.

## Pillars

Categories carry `pillar`: `home`, `business` or `wildfire`. Hubs: `/home-safety/`,
`/business/`, `/wildfire/`; `/categories/` lists everything. Business products carry extra
guide fields: `standards`, `whoNeeds`, `caveats`, `sources`, `costNote`.

Retired Oct 2026 (redirects in `public/_redirects`): the paid Priority Alerts offer, smoke &
air quality, go-bags, power stations, cameras, and the go-bag and smoke-season guides.

## Live data (fire map + Amazon images)

Hosting is Netlify, which charges credits per production deploy (15 each; the
free plan has 300/month). So anything that changes more often than the content
does NOT trigger a rebuild. Instead `.github/workflows/refresh-live-data.yml`
runs every 30 minutes on GitHub Actions (free for this public repo), regenerates
the data and force-pushes it as a single commit to the **`live-data`** branch.
Pages read it in the browser from
`https://raw.githubusercontent.com/davebussell/killflare/live-data/<file>`.

| File | Script | Used by |
|---|---|---|
| `fires.geojson`, `meta.json` | `scripts/fetch-fires.mjs` | `/live-map/` |
| `amazon-images.json` | `scripts/fetch-amazon-images.mjs` | product pages (`ProductImage` with `amazon`) |

MapLibre's web worker is bundled explicitly (`?worker&url` + `setWorkerUrl`) in
`live-map.astro`. Without it the bundled map draws only hillshade, with no roads, labels or dots.

The fire script also runs as `prebuild`, so every Netlify build bakes a fallback
copy into `/live/` in case GitHub is unreachable.

GitHub repo secrets (Settings → Secrets and variables → Actions):

- `FIRMS_MAP_KEY` (optional): free NASA FIRMS key, used only as a US fallback if CWFIS
  returns no US points. CWFIS's `hotspots_last24hrs` layer already covers Canada and the US
  (its `agency` field is the province or state; note `CA` there means California). Get a key at
  <https://firms.modaps.eosdis.nasa.gov/api/map_key/>.
- `AMAZON_CREATORS_CREDENTIAL_ID` / `AMAZON_CREATORS_CREDENTIAL_SECRET`: from
  Associates Central → Tools → Creators API, once Amazon unlocks API access
  for the account. Optional repo *variable* `AMAZON_CREATORS_CREDENTIAL_VERSION`
  (default `2.1`; use `3.1` if Associates Central issues a v3 credential).
  Without them, product pages keep the designed placeholder plates.

PA-API 5 was retired by Amazon in 2026. The Creators API replaces it, and
`fetch-amazon-images.mjs` uses it. Images are refreshed every run rather than
stored, and they appear only on product pages, where each image links to its
Amazon listing. Product cards keep the plate because the whole card already
links in-site, and Amazon images must link back to Amazon.

The fire map is raw satellite detection data, not alerts. It links out to InciWeb
and the CWFIS interactive map for anything official.

## Affiliate tags

Search-and-replace before launch:

- `AFFILIATE_TAG`     → your Amazon.com Associates tag (e.g. `killflare-20`)
- `AFFILIATE_TAG_CA`  → your Amazon.ca Associates tag (e.g. `killflare0c-20`)

Amazon search links are placeholders; swap in ASIN links (`https://www.amazon.com/dp/ASIN?tag=...`) as you settle on specific SKUs.

## Deploy

Netlify builds every push to `main` (`npm run build` → `dist`) and serves killflare.com.
Netlify DNS hosts the zone. The old GitHub Pages workflow was removed on 2 October 2026.
It was building a second copy of the site on every push, which only redirected to
killflare.com. Turn Pages off in repo Settings → Pages.

GitHub Actions now runs only `refresh-live-data.yml` (see Live data above).

## Before launch

- [ ] Replace affiliate tag placeholders
- [ ] Set up `hello@killflare.com` (or change the address in `src/pages/about.astro`)
- [ ] Add product images if you want them (cards are text-only by design for v1)
- [ ] Submit `https://killflare.com/sitemap-index.xml` to Search Console
