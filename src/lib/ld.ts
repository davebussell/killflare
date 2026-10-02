// Structured-data helpers. Every page already carries the site-wide
// Organization + WebSite graph from Base.astro; these add the page's own
// entity and a breadcrumb trail, referencing the organization by @id.

const SITE = 'https://killflare.com';
const ORG = { '@id': `${SITE}/#organization` };

export function article(opts: { path: string; headline: string; description: string; about?: object }) {
  const url = `${SITE}${opts.path}`;
  return {
    '@type': 'Article',
    '@id': `${url}#article`,
    headline: opts.headline.slice(0, 110),
    description: opts.description,
    mainEntityOfPage: url,
    url,
    image: `${SITE}/og-default.png`,
    inLanguage: 'en',
    author: ORG,
    publisher: ORG,
    ...(opts.about ? { about: opts.about } : {}),
  };
}

export function breadcrumbs(trail: [name: string, path: string][]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${SITE}${path}`,
    })),
  };
}

export const graph = (...nodes: object[]) => ({ '@context': 'https://schema.org', '@graph': nodes });
