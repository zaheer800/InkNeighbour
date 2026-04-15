import { describe, it, expect } from 'vitest'
import { buildUPILink, getUPIPaymentData } from '../../payments/upi'

describe('buildUPILink', () => {
  it('builds a valid UPI deep link', () => {
    const link = buildUPILink('zaheer@upi', 'InkShop', 1800)
    expect(link).toMatch(/^upi:\/\/pay\?/)
    expect(link).toContain('pa=zaheer%40upi')
    expect(link).toContain('cu=INR')
  })

  it('converts paise to rupees correctly', () => {
    // 1800 paise = ₹18.00
    const link = buildUPILink('test@upi', 'Shop', 1800)
    expect(link).toContain('am=18.00')
  })

  it('converts 500 paise to ₹5.00', () => {
    const link = buildUPILink('test@upi', 'Shop', 500)
    expect(link).toContain('am=5.00')
  })

  it('URL-encodes the payee name', () => {
    const link = buildUPILink('test@upi', 'My Print Shop', 200)
    expect(link).toContain('pn=My%20Print%20Shop')
  })

  it('URL-encodes UPI ID with @ symbol', () => {
    const link = buildUPILink('user@okicici', 'Shop', 200)
    expect(link).toContain('pa=user%40okicici')
  })
})

describe('getUPIPaymentData', () => {
  it('returns type upi', () => {
    const data = getUPIPaymentData({ upiId: 'test@upi', shopName: 'Shop', amount: 1000, countryCode: 'IN' })
    expect(data.type).toBe('upi')
  })

  it('includes upiId and shopName', () => {
    const data = getUPIPaymentData({ upiId: 'test@upi', shopName: 'My Shop', amount: 1000, countryCode: 'IN' })
    expect(data.upiId).toBe('test@upi')
    expect(data.shopName).toBe('My Shop')
  })

  it('includes a valid upiLink', () => {
    const data = getUPIPaymentData({ upiId: 'test@upi', shopName: 'Shop', amount: 800, countryCode: 'IN' })
    expect(data.upiLink).toMatch(/^upi:\/\//)
  })
})
