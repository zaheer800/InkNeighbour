/**
 * WhatsApp notification module — Phase 1.
 * Builds wa.me deep links for manual owner notifications.
 * Phase 2: WATI automated API (uncomment when ready).
 */

/**
 * Build a WhatsApp deep link with a pre-filled message.
 * @param {string} phone - Phone number with country code, no spaces or +
 * @param {object} jobDetails - Job info for the message
 * @returns {string} wa.me URL
 */
export function buildWhatsAppLink(phone, jobDetails) {
  const { jobNumber, customerName, customerFlat, pageCount, printType, copies, amount } = jobDetails

  const message = [
    `📦 New Print Job: ${jobNumber}`,
    `👤 ${customerName} (Flat ${customerFlat})`,
    `📄 ${pageCount ?? '?'} pages · ${printType === 'bw' ? 'B&W' : 'Colour'} · ${copies} copy`,
    `💰 ₹${(amount / 100).toFixed(0)}`,
    `\nGo to dashboard to accept.`
  ].join('\n')

  // Normalise phone: remove +, spaces, dashes
  const normalised = phone.replace(/[\s+\-()]/g, '')

  return `https://wa.me/${normalised}?text=${encodeURIComponent(message)}`
}

/**
 * Build a share link for owner to share their shop URL via WhatsApp.
 * @param {string} shopUrl
 * @param {string} societyName
 * @returns {string} wa.me URL
 */
export function buildShopShareLink(shopUrl, societyName) {
  const message = `I've set up a print shop for ${societyName}! Send me your documents here:\n${shopUrl}`
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}
