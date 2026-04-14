/**
 * Browser push notification module — Phase 1 (VAPID).
 * Owners receive push alerts when new jobs are placed.
 */

import { supabase } from '../lib/supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

/**
 * Request browser push permission from the user.
 * @returns {Promise<NotificationPermission>}
 */
export async function requestPushPermission() {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

/**
 * Subscribe the owner to push notifications and save to Supabase.
 * @param {string} ownerId
 * @returns {Promise<PushSubscription|null>}
 */
export async function subscribeToPush(ownerId) {
  if (!('serviceWorker' in navigator) || !VAPID_PUBLIC_KEY) return null

  try {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    await supabase.from('push_subscriptions').upsert({
      owner_id: ownerId,
      subscription: JSON.stringify(subscription),
      device: navigator.userAgent
    })

    return subscription
  } catch (err) {
    console.warn('Push subscription failed:', err)
    return null
  }
}

/**
 * Unsubscribe the owner from push notifications.
 * @param {string} ownerId
 */
export async function unsubscribeFromPush(ownerId) {
  if (!('serviceWorker' in navigator)) return

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()
  if (subscription) {
    await subscription.unsubscribe()
    await supabase.from('push_subscriptions').delete().eq('owner_id', ownerId)
  }
}
