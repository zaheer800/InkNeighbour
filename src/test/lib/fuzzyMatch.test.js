import { describe, it, expect } from 'vitest'
import { findSimilarSocieties, getDuplicateWarning } from '../../lib/fuzzyMatch'

const SOCIETIES = [
  { id: '1', name: 'Sunshine Apartments' },
  { id: '2', name: 'Green Valley Society' },
  { id: '3', name: 'Blue Ridge Tower' },
  { id: '4', name: 'Lakeview Residency' }
]

describe('findSimilarSocieties', () => {
  it('returns exact match', () => {
    const results = findSimilarSocieties('Sunshine Apartments', SOCIETIES)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].item.name).toBe('Sunshine Apartments')
  })

  it('detects near-duplicate (typo)', () => {
    const results = findSimilarSocieties('Sunshin Apartments', SOCIETIES)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].item.name).toBe('Sunshine Apartments')
  })

  it('returns empty for completely different name', () => {
    const results = findSimilarSocieties('XYZ Colony 999', SOCIETIES)
    expect(results.length).toBe(0)
  })

  it('returns empty for empty input', () => {
    expect(findSimilarSocieties('', SOCIETIES)).toHaveLength(0)
  })

  it('returns empty for null societies', () => {
    expect(findSimilarSocieties('Sunshine', null)).toHaveLength(0)
  })

  it('returns empty for empty societies array', () => {
    expect(findSimilarSocieties('Sunshine', [])).toHaveLength(0)
  })

  it('detects "Greeen Valley Society" (extra letter) as similar to "Green Valley Society"', () => {
    const results = findSimilarSocieties('Greeen Valley Society', SOCIETIES)
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].item.name).toBe('Green Valley Society')
  })
})

describe('getDuplicateWarning', () => {
  it('returns the matching society for a near-duplicate name (typo)', () => {
    const match = getDuplicateWarning('Sunshinee Apartments', SOCIETIES)
    expect(match).not.toBeNull()
    expect(match.name).toBe('Sunshine Apartments')
  })

  it('returns null for a unique name', () => {
    const match = getDuplicateWarning('Entirely New Place', SOCIETIES)
    expect(match).toBeNull()
  })

  it('returns null for very short input', () => {
    const match = getDuplicateWarning('AB', SOCIETIES)
    expect(match).toBeNull()
  })
})
