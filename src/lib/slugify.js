/**
 * Generate a URL-safe slug from a society name.
 * Used for shop URLs: inkneighbour.zakapedia.in/:slug
 */
export function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')   // remove non-alphanumeric
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
}

/**
 * Generate a shop slug from a society name, appending a short suffix
 * to avoid collisions when needed.
 * @param {string} societyName
 * @param {string} [suffix] - Optional suffix (e.g., city abbreviation)
 */
export function makeShopSlug(societyName, suffix) {
  const base = slugify(societyName)
  return suffix ? `${base}-${slugify(suffix)}` : base
}
