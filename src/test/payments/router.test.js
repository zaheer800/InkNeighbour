import { describe, it, expect } from 'vitest'
import { getPaymentMethods, getPaymentData } from '../../payments/index'

const ownerWithUPI = { upi_id: 'test@upi', accept_cash: true }
const ownerCashOnly = { upi_id: null, accept_cash: true }
const ownerUPIOnly = { upi_id: 'test@upi', accept_cash: false }
const ownerNoPayment = { upi_id: null, accept_cash: false }

describe('getPaymentMethods', () => {
  it('returns both UPI and cash when owner has UPI ID and accept_cash', () => {
    const methods = getPaymentMethods('IN', ownerWithUPI)
    expect(methods.map(m => m.id)).toContain('upi')
    expect(methods.map(m => m.id)).toContain('cash')
  })

  it('returns only cash when no UPI ID', () => {
    const methods = getPaymentMethods('IN', ownerCashOnly)
    expect(methods).toHaveLength(1)
    expect(methods[0].id).toBe('cash')
  })

  it('returns only UPI when cash is disabled', () => {
    const methods = getPaymentMethods('IN', ownerUPIOnly)
    expect(methods).toHaveLength(1)
    expect(methods[0].id).toBe('upi')
  })

  it('returns empty array when no payment methods configured', () => {
    const methods = getPaymentMethods('IN', ownerNoPayment)
    expect(methods).toHaveLength(0)
  })

  it('does not return UPI for non-UPI countries', () => {
    // US does not support UPI
    const methods = getPaymentMethods('US', ownerWithUPI)
    expect(methods.map(m => m.id)).not.toContain('upi')
  })
})

describe('getPaymentData — routing', () => {
  it('routes cash method to cash module', () => {
    const data = getPaymentData('cash', { ownerName: 'Zaheer', amount: 1000, countryCode: 'IN' })
    expect(data.type).toBe('cash')
  })

  it('routes upi method to upi module', () => {
    const data = getPaymentData('upi', { upiId: 'test@upi', shopName: 'Shop', amount: 1000, countryCode: 'IN' })
    expect(data.type).toBe('upi')
  })

  it('returns null for unknown method', () => {
    const data = getPaymentData('stripe', {})
    expect(data).toBeNull()
  })
})
