/**
 * Price calculation utilities.
 * All values in smallest currency unit (paise for INR, cents for USD).
 * NEVER inline this formula — always use these functions.
 */

/**
 * Calculate the total price for a print job.
 * @param {number} pages - Number of pages in the document
 * @param {number} copies - Number of copies
 * @param {number} ratePerPage - Rate per page in smallest currency unit
 * @param {number} deliveryFee - Flat delivery fee in smallest currency unit
 * @returns {number} Total in smallest currency unit
 */
export function calculateTotal(pages, copies, ratePerPage, deliveryFee) {
  return (pages * copies * ratePerPage) + deliveryFee
}

/**
 * Get the rate per page for a given print type.
 * @param {'bw'|'color'} printType
 * @param {object} owner - Owner record with bw_rate and color_rate
 * @returns {number} Rate per page in smallest currency unit
 */
export function getRatePerPage(printType, owner) {
  return printType === 'color' ? owner.color_rate : owner.bw_rate
}

/**
 * Validate that a proposed rate is within ±50% of the platform default.
 * @param {number} proposedRate - Rate proposed by owner (smallest unit)
 * @param {number} defaultRate - Platform default rate (smallest unit)
 * @returns {{ valid: boolean, min: number, max: number }}
 */
export function validateRate(proposedRate, defaultRate) {
  const min = Math.floor(defaultRate * 0.5)
  const max = Math.ceil(defaultRate * 1.5)
  return {
    valid: proposedRate >= min && proposedRate <= max,
    min,
    max
  }
}

/**
 * Build a price breakdown for display.
 * @param {number} pages
 * @param {number} copies
 * @param {number} ratePerPage - in smallest unit
 * @param {number} deliveryFee - in smallest unit
 * @returns {{ printSubtotal: number, deliveryFee: number, total: number }}
 */
export function getPriceBreakdown(pages, copies, ratePerPage, deliveryFee) {
  const printSubtotal = pages * copies * ratePerPage
  return {
    printSubtotal,
    deliveryFee,
    total: printSubtotal + deliveryFee
  }
}
