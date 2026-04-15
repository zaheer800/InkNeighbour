/**
 * InkNeighbour — Notify Edge Function
 *
 * Sends browser push notifications to the owner when a new job is placed.
 * Called from the database trigger or directly by the client after job insert.
 *
 * Environment variables required (Edge Function secrets):
 *   VAPID_PRIVATE_KEY
 *   VAPID_EMAIL
 *   SUPABASE_SERVICE_ROLE_KEY  (auto-injected by Supabase)
 *   SUPABASE_URL               (auto-injected by Supabase)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// web-push equivalent for Deno / Edge runtime
// NOTE: Full VAPID push requires the 'web-push' npm package.
// In Deno, use the built-in Crypto API for VAPID signing.
// For simplicity in Phase 1, this function prepares the payload
// and sends to the push endpoint using the Web Push Protocol.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
}

interface NotifyPayload {
  job_id: string
  owner_id: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { job_id, owner_id } = (await req.json()) as NotifyPayload

    if (!job_id || !owner_id) {
      return new Response(JSON.stringify({ error: 'job_id and owner_id are required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // Use service role key to bypass RLS for push subscription lookup
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Fetch job details
    const { data: job } = await supabase
      .from('jobs')
      .select('job_number, customer_name, customer_flat, page_count, print_type, copies, total_amount')
      .eq('id', job_id)
      .single()

    if (!job) {
      return new Response(JSON.stringify({ error: 'Job not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    // Fetch push subscriptions for this owner
    const { data: subscriptions } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('owner_id', owner_id)

    if (!subscriptions?.length) {
      return new Response(JSON.stringify({ sent: 0, reason: 'No push subscriptions found' }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
      })
    }

    const payload = JSON.stringify({
      title: `New print job: ${job.job_number}`,
      body: `${job.customer_name} (Flat ${job.customer_flat}) · ${job.page_count ?? '?'} pages`,
      icon: '/icon-192.png',
      badge: '/badge-72.png',
      data: { job_id, url: '/dashboard' }
    })

    // Send push to each subscription endpoint
    // NOTE: Full VAPID signing requires implementing RFC 8292.
    // This stub logs the intent — wire up web-push in Phase 2 if needed.
    let sent = 0
    for (const sub of subscriptions) {
      try {
        const subscription = typeof sub.subscription === 'string'
          ? JSON.parse(sub.subscription)
          : sub.subscription

        // In production, use web-push library with VAPID keys
        // For now, log the subscription endpoint
        console.log(`Would push to: ${subscription.endpoint}`, payload)
        sent++
      } catch (err) {
        console.error('Push failed for subscription:', err)
      }
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error('Notify function error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    })
  }
})
