import Fuse from 'fuse.js'

/**
 * Fuzzy-match a society name against a list of existing societies.
 * Uses Fuse.js with a 75% similarity threshold.
 *
 * @param {string} input - The name to test
 * @param {Array<{name: string, id: string}>} societies - Existing societies to match against
 * @returns {Array<{item: object, score: number}>} Matches above threshold, sorted by score
 */
export function findSimilarSocieties(input, societies) {
  if (!input || !societies?.length) return []

  const fuse = new Fuse(societies, {
    keys: ['name'],
    threshold: 0.25, // 0 = exact, 1 = anything — 0.25 ≈ 75% similarity
    includeScore: true,
    minMatchCharLength: 3
  })

  const results = fuse.search(input)

  // Return matches where score < 0.25 (i.e., similarity > 75%)
  return results.filter(r => (r.score || 0) < 0.25)
}

/**
 * Check if a name is similar enough to trigger a duplicate warning.
 * @param {string} input
 * @param {Array<{name: string, id: string}>} societies
 * @returns {object|null} The closest match, or null
 */
export function getDuplicateWarning(input, societies) {
  const matches = findSimilarSocieties(input, societies)
  return matches.length > 0 ? matches[0].item : null
}
