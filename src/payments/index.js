/**
 * Payment method router.
 * Phase 1: UPI (India) and Cash on Delivery.
 * Phase 2: Stripe (global) — stubbed, not active.
 *
 * Always route through this module — never import upi.js or cash.js directly
 * from components, so providers can be swapped per country.
 */

import { getCountry } from '../lib/countries'
import { getUPIPaymentData } from './upi'
import { getCashPaymentData } from './cash'

/**
 * Get available payment methods for a given country and owner config.
 * @param {string} countryCode
 * @param {object} owner - Owner record
 * @returns {Array<{id: string, label: string}>}
 */
export function getPaymentMethods(countryCode, owner) {
  const country = getCountry(countryCode)
  const methods = []

  if (country.payment_providers.includes('upi') && owner.upi_id) {
    methods.push({ id: 'upi', label: 'UPI' })
  }
  if (owner.accept_cash) {
    methods.push({ id: 'cash', label: 'Cash on Delivery' })
  }

  return methods
}

/**
 * Get payment display data for a completed order.
 * @param {string} method - 'upi' | 'cash'
 * @param {object} params - { upiId, shopName, amount, ownerName, countryCode }
 */
export function getPaymentData(method, params) {
  if (method === 'upi') return getUPIPaymentData(params)
  if (method === 'cash') return getCashPaymentData(params)
  return null
}
