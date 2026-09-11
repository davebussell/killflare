// Site-wide settings. Change them here, nowhere else.

/** Contact address shown across the site and used in mailto: links. */
export const CONTACT_EMAIL = 'dave@clickshift.ca';

/**
 * Amazon Associates tracking IDs.
 *
 * Leave these null until the Associates accounts are approved. While they are
 * null, Amazon links render clean (no tag parameter) — which is what Amazon
 * requires, and avoids sending traffic with a fake tag on it.
 *
 * When the tags arrive, paste them in. Amazon.ca and Amazon.com are separate
 * programs with separate IDs; a US tag on an amazon.ca link earns nothing.
 * Format is usually something like 'killflare-20' (US) / 'killflare09-20' (CA).
 */
export const AMAZON_TAG_US: string | null = null;
export const AMAZON_TAG_CA: string | null = null;

/** True once at least one Associates tag is live. */
export const HAS_AFFILIATE_TAGS = Boolean(AMAZON_TAG_US || AMAZON_TAG_CA);

/**
 * Swap the AFFILIATE_TAG placeholders in products.json for the real tracking
 * IDs. If the relevant tag isn't set yet, the tag parameter is stripped so the
 * link still works as an ordinary Amazon search.
 */
export function resolveLink(url: string): string {
  return url
    .replace(/([?&])tag=AFFILIATE_TAG_CA/g, (_m, sep) => (AMAZON_TAG_CA ? `${sep}tag=${AMAZON_TAG_CA}` : ''))
    .replace(/([?&])tag=AFFILIATE_TAG/g, (_m, sep) => (AMAZON_TAG_US ? `${sep}tag=${AMAZON_TAG_US}` : ''))
    .replace(/\?&/, '?')
    .replace(/[?&]$/, '');
}
