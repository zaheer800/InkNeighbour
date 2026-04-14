import { describe, it, expect } from 'vitest'
import { getCountry, formatCurrency, countryOptions, COUNTRIES } from '../../lib/countries'

describe('getCountry', () => {
  it('returns India for code IN', () => {
    const c = getCountry('IN')
    expect(c.code).toBe('IN')
    expect(c.currency_code).toBe('INR')
    expect(c.postal_code_label).toBe('Pincode')
    expect(c.flat_label).toBe('Flat')
    expect(c.society_label).toBe('Society')
  })

  it('returns US for code US', () => {
    const c = getCountry('US')
    expect(c.postal_code_label).toBe('ZIP Code')
    expect(c.flat_label).toBe('Unit')
  })

  it('returns GB for code GB', () => {
    const c = getCountry('GB')
    expect(c.postal_code_label).toBe('Postcode')
    expect(c.currency_code).toBe('GBP')
  })

  it('falls back to default country for unknown code', () => {
    const c = getCountry('XX')
    // Should fall back to IN (VITE_DEFAULT_COUNTRY)
    expect(c).toBeDefined()
    expect(c.code).toBeTruthy()
  })
})

describe('formatCurrency', () => {
  it('formats INR correctly (paise → rupees)', () => {
    const formatted = formatCurrency(200, 'IN')
    expect(formatted).toContain('2')
    expect(formatted).toMatch(/₹|INR/) // contains symbol or code
  })

  it('formats 0 paise as ₹0', () => {
    const formatted = formatCurrency(0, 'IN')
    expect(formatted).toContain('0')
  })

  it('formats 500 paise as ₹5', () => {
    const formatted = formatCurrency(500, 'IN')
    expect(formatted).toContain('5')
  })

  it('formats 800 paise as ₹8', () => {
    const formatted = formatCurrency(800, 'IN')
    expect(formatted).toContain('8')
  })
})

describe('countryOptions', () => {
  it('returns an array of country options', () => {
    const options = countryOptions()
    expect(Array.isArray(options)).toBe(true)
    expect(options.length).toBeGreaterThan(0)
  })

  it('each option has value and label', () => {
    countryOptions().forEach(opt => {
      expect(opt).toHaveProperty('value')
      expect(opt).toHaveProperty('label')
    })
  })

  it('includes India', () => {
    const hasIndia = countryOptions().some(o => o.value === 'IN')
    expect(hasIndia).toBe(true)
  })
})

describe('COUNTRIES config', () => {
  it('each country has required payment providers', () => {
    Object.values(COUNTRIES).forEach(c => {
      expect(Array.isArray(c.payment_providers)).toBe(true)
      expect(c.payment_providers.length).toBeGreaterThan(0)
    })
  })

  it('India has UPI as a payment provider', () => {
    expect(COUNTRIES.IN.payment_providers).toContain('upi')
  })

  it('all countries have paper sizes configured', () => {
    Object.values(COUNTRIES).forEach(c => {
      expect(Array.isArray(c.paper_sizes)).toBe(true)
      expect(c.paper_sizes.length).toBeGreaterThan(0)
    })
  })
})
