/**
 * UPI payment module — Phase 1 (India).
 * Generates UPI deep links for payment apps.
 */

/**
 * Build a UPI deep link URL.
 * @param {string} upiId - Owner's UPI ID (e.g., zaheer@upi)
 * @param {string} name - Payee name
 * @param {number} amountPaise - Amount in paise
 * @returns {string} UPI deep link
 */
export function buildUPILink(upiId, name, amountPaise) {
  const amount = (amountPaise / 100).toFixed(2)
  return `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(name)}&am=${amount}&cu=INR`
}

/**
 * Get UPI payment display data for OrderConfirm page.
 */
export function getUPIPaymentData({ upiId, shopName, amount, countryCode }) {
  return {
    type: 'upi',
    upiId,
    shopName,
    amount,
    countryCode,
    upiLink: buildUPILink(upiId, shopName, amount)
  }
}
