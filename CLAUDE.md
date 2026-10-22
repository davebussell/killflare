# killflare.com — rules for Claude

Portfolio-wide rules and the registry of every site live in `davebussell/portfolio-hq` — read its CLAUDE.md too, then `README.md` here.

## Every chat
1. **First:** attach this repo (`list_repos`, then `add_repo` with push access) and clone it. Do not start from the laptop folder
   (`OneDrive\Desktop\killflare`) or the Desktop `.cmd` scripts; a chat with this repo attached can push directly.
2. **Last:** commit, push to `main`, wait for Netlify's build, then confirm the live URL. "Done" means pushed **and** live.
3. If the repo, the deploy path or the Netlify project changes, update the `portfolio-hq` registry row.

## Netlify
- Project `killflare` (`ec54aabb-78bb-4553-9150-139dc009ddd6`) at https://killflare.com. **Linked to this repo: every push to `main`
  builds and deploys** (`npm run build`, publish `dist`; `prebuild` fetches the live fire data). The `live-data` branch holds the map's
  data snapshots.
- So never push to `main` without Dave's OK for it to go live, and never deploy by upload: the next push would overwrite it.
- On 2026-10-22 `main` was brought level with the live site: the reposition (`22bd516`, which had only reached the laptop as a git
  bundle) plus the product-note edits that an upload deploy had put live at 02:09 UTC (`32717b2`, taken from that deploy's source zip).
- Netlify Forms: `contractor-listing` (on `/contractors/`). `installer-listing` and `alert-details` belong to retired pages.
- Analytics: Netlify snippet injection adds GA4 and Clarity. Never put the tags in the source.

## Standards
- Check every change at 375px and at 1280px+ before saying done.
- Keep the SEO basics (title, description, canonical, Open Graph, sitemap, `robots.txt`) intact.
