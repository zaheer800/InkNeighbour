import { describe, it, expect } from 'vitest'
import { slugify, makeShopSlug, getShopUrl } from '../../lib/slugify'

describe('slugify', () => {
  it('converts spaces to hyphens', () => {
    expect(slugify('Sunshine Apartments')).toBe('sunshine-apartments')
  })

  it('lowercases the string', () => {
    expect(slugify('CAPITAL LETTERS')).toBe('capital-letters')
  })

  it('removes special characters', () => {
    expect(slugify('Flat! No. 5 & Co.')).toBe('flat-no-5-co')
  })

  it('collapses multiple hyphens', () => {
    expect(slugify('A  --  B')).toBe('a-b')
  })

  it('trims leading and trailing hyphens', () => {
    expect(slugify('--hello--')).toBe('hello')
  })

  it('handles already-lowercase input', () => {
    expect(slugify('my society')).toBe('my-society')
  })

  it('strips diacritics (accented characters)', () => {
    expect(slugify('Café Résidence')).toBe('cafe-residence')
  })

  it('handles numeric characters', () => {
    expect(slugify('Tower 42 Block B')).toBe('tower-42-block-b')
  })

  it('returns empty string for empty input', () => {
    expect(slugify('')).toBe('')
  })
})

describe('makeShopSlug', () => {
  it('creates slug from society name alone', () => {
    expect(makeShopSlug('Green Valley')).toBe('green-valley')
  })

  it('appends suffix when provided', () => {
    expect(makeShopSlug('Green Valley', '400001')).toBe('green-valley-400001')
  })

  it('slugifies both name and suffix', () => {
    expect(makeShopSlug('Green Valley', 'Mumbai West')).toBe('green-valley-mumbai-west')
  })
})

describe('getShopUrl', () => {
  it('builds a URL from the owner\'s own slug', () => {
    expect(getShopUrl({ slug: 'quick-print' })).toBe(`${window.location.origin}/quick-print`)
  })

  it('falls back to the society slug for legacy rows without their own slug', () => {
    expect(getShopUrl({ societies: { slug: 'green-valley' } })).toBe(`${window.location.origin}/green-valley`)
  })

  it('prefers the owner\'s own slug over the society slug', () => {
    expect(getShopUrl({ slug: 'quick-print', societies: { slug: 'green-valley' } })).toBe(`${window.location.origin}/quick-print`)
  })

  it('returns empty string when there is no slug anywhere', () => {
    expect(getShopUrl({})).toBe('')
    expect(getShopUrl(null)).toBe('')
    expect(getShopUrl(undefined)).toBe('')
  })
})
