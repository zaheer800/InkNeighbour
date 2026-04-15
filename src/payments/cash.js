/**
 * Cash on Delivery payment module — Phase 1 (universal).
 * No API integration needed — just display instructions.
 */

/**
 * Get cash payment display data for OrderConfirm page.
 */
export function getCashPaymentData({ ownerName, amount, countryCode }) {
  return {
    type: 'cash',
    ownerName,
    amount,
    countryCode
  }
}
