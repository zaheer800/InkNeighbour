import { describe, it, expect } from 'vitest'
import { getCashPaymentData } from '../../payments/cash'

describe('getCashPaymentData', () => {
  it('returns type cash', () => {
    const data = getCashPaymentData({ ownerName: 'Zaheer', amount: 1800, countryCode: 'IN' })
    expect(data.type).toBe('cash')
  })

  it('includes ownerName', () => {
    const data = getCashPaymentData({ ownerName: 'Zaheer Khan', amount: 1800, countryCode: 'IN' })
    expect(data.ownerName).toBe('Zaheer Khan')
  })

  it('includes amount', () => {
    const data = getCashPaymentData({ ownerName: 'Ali', amount: 2500, countryCode: 'IN' })
    expect(data.amount).toBe(2500)
  })

  it('includes countryCode', () => {
    const data = getCashPaymentData({ ownerName: 'Ali', amount: 100, countryCode: 'IN' })
    expect(data.countryCode).toBe('IN')
  })
})
