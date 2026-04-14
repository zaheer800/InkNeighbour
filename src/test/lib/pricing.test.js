import { describe, it, expect } from 'vitest'
import {
  calculateTotal,
  getRatePerPage,
  validateRate,
  getPriceBreakdown
} from '../../lib/pricing'

describe('pricing — calculateTotal', () => {
  it('calculates total for a simple job', () => {
    // 5 pages × 1 copy × ₹2 (200 paise) + ₹8 delivery (800 paise) = ₹18 (1800 paise)
    expect(calculateTotal(5, 1, 200, 800)).toBe(1800)
  })

  it('multiplies copies correctly', () => {
    // 5 pages × 3 copies × 200 paise + 800 delivery = 3800
    expect(calculateTotal(5, 3, 200, 800)).toBe(3800)
  })

  it('handles zero delivery fee', () => {
    expect(calculateTotal(10, 1, 200, 0)).toBe(2000)
  })

  it('handles single page single copy', () => {
    expect(calculateTotal(1, 1, 500, 800)).toBe(1300)
  })

  it('handles colour rate', () => {
    // 4 pages × 2 copies × 500 paise + 800 = 4800
    expect(calculateTotal(4, 2, 500, 800)).toBe(4800)
  })
})

describe('pricing — getRatePerPage', () => {
  const owner = { bw_rate: 200, color_rate: 500 }

  it('returns bw_rate for bw print type', () => {
    expect(getRatePerPage('bw', owner)).toBe(200)
  })

  it('returns color_rate for color print type', () => {
    expect(getRatePerPage('color', owner)).toBe(500)
  })

  it('defaults to bw_rate for unknown type', () => {
    expect(getRatePerPage('unknown', owner)).toBe(200)
  })
})

describe('pricing — validateRate', () => {
  const defaultRate = 200 // ₹2.00 = 200 paise

  it('accepts rate exactly at the default', () => {
    const result = validateRate(200, defaultRate)
    expect(result.valid).toBe(true)
  })

  it('accepts rate at lower bound (50% of default)', () => {
    const result = validateRate(100, defaultRate)
    expect(result.valid).toBe(true)
    expect(result.min).toBe(100)
  })

  it('accepts rate at upper bound (150% of default)', () => {
    const result = validateRate(300, defaultRate)
    expect(result.valid).toBe(true)
    expect(result.max).toBe(300)
  })

  it('rejects rate below lower bound', () => {
    expect(validateRate(99, defaultRate).valid).toBe(false)
  })

  it('rejects rate above upper bound', () => {
    expect(validateRate(301, defaultRate).valid).toBe(false)
  })

  it('returns correct min/max bounds', () => {
    const { min, max } = validateRate(200, 200)
    expect(min).toBe(100)
    expect(max).toBe(300)
  })
})

describe('pricing — getPriceBreakdown', () => {
  it('returns correct breakdown components', () => {
    const result = getPriceBreakdown(5, 2, 200, 800)
    expect(result.printSubtotal).toBe(2000) // 5×2×200
    expect(result.deliveryFee).toBe(800)
    expect(result.total).toBe(2800)
  })

  it('total equals printSubtotal + deliveryFee', () => {
    const result = getPriceBreakdown(3, 1, 500, 0)
    expect(result.total).toBe(result.printSubtotal + result.deliveryFee)
  })

  it('handles zero delivery fee', () => {
    const result = getPriceBreakdown(2, 1, 200, 0)
    expect(result.deliveryFee).toBe(0)
    expect(result.total).toBe(400)
  })
})
