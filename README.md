# killflare.com

Wildfire home-defense product guide. Astro static site, deployed to GitHub Pages.

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

## Affiliate tags

Search-and-replace before launch:

- `AFFILIATE_TAG`     → your Amazon.com Associates tag (e.g. `killflare-20`)
- `AFFILIATE_TAG_CA`  → your Amazon.ca Associates tag (e.g. `killflare0c-20`)

Amazon search links are placeholders; swap in ASIN links (`https://www.amazon.com/dp/ASIN?tag=...`) as you settle on specific SKUs.

## Deploy (GitHub Pages)

1. Create repo `davebussell/killflare`, push `main`.
2. Repo Settings → Pages → Source: **GitHub Actions**. The workflow in `.github/workflows/deploy.yml` builds and deploys on every push.
3. Settings → Pages → Custom domain: `killflare.com` (the `public/CNAME` file is already there). Tick "Enforce HTTPS" once the cert issues.
4. GoDaddy DNS:
   - `A` @ → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - `CNAME` www → `davebussell.github.io`

## Before launch

- [ ] Replace affiliate tag placeholders
- [ ] Set up `hello@killflare.com` (or change the address in `src/pages/about.astro`)
- [ ] Add product images if you want them (cards are text-only by design for v1)
- [ ] Submit `https://killflare.com/sitemap-index.xml` to Search Console
