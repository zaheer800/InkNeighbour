/**
 * Notification method router.
 * Phase 1: Browser push (VAPID) for owners, WhatsApp wa.me links.
 * Phase 2: WATI automated WhatsApp API — stub.
 * Phase 3: Twilio SMS — stub.
 *
 * Always route through this module — never import provider files directly
 * from components, so providers can be swapped without touching UI code.
 */

import { getCountry } from '../lib/countries'
import { buildWhatsAppLink } from './whatsapp'
import { requestPushPermission, subscribeToPush } from './browser'

/**
 * Get the notification provider for a given country.
 * @param {string} countryCode
 */
export function getNotificationProvider(countryCode) {
  const country = getCountry(countryCode)
  return country.notificationProvider // 'whatsapp' | 'sms'
}

/**
 * Build a WhatsApp share link for a new order notification to the owner.
 * Phase 1: manual link only (no automated API).
 */
export function getOwnerWhatsAppLink(ownerPhone, jobDetails) {
  return buildWhatsAppLink(ownerPhone, jobDetails)
}

/**
 * Request browser push permission and subscribe the owner.
 * @returns {Promise<PushSubscription|null>}
 */
export async function setupOwnerPush(ownerId) {
  const permission = await requestPushPermission()
  if (permission !== 'granted') return null
  return subscribeToPush(ownerId)
}
