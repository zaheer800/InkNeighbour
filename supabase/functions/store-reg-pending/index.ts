/**
 * InkNeighbour — store-reg-pending Edge Function
 *
 * Persists the pending owner registration payload into the auth user's
 * metadata so it survives cross-device email confirmation flows.
 * Called from the frontend immediately after signUp() in the deferred path
 * (when email confirmation is enabled and there is no session yet).
 *
 * There is no session token yet (email unconfirmed), so the caller cannot be authenticated.
 * Hardened 2026-09-20 to limit what an unauthenticated caller can do:
 *  - user_id must be a UUID naming an account that is real, still UNCONFIRMED and created
 *    in the last 48 hours (the comment above always said it validated "a real user";
 *    the code did not). Confirmed/older accounts can no longer be written to.
 *  - the payload must be a plain object of at most 8 KB.
 *  - existing user metadata is preserved (merged) instead of replaced.
 *  - CORS limited to the app's origins; internal error text is not echoed back.
 *
 * Environment variables:
 *   ALLOWED_ORIGINS  — comma-separated browser origins allowed to call this
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ?? 'https://inkneighbour.zakapedia.in,http://localhost:5173'
).split(',').map((s) => s.trim()).filter(Boolean)

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_PAYLOAD_BYTES = 8 * 1024
const MAX_ACCOUNT_AGE_MS = 48 * 60 * 60 * 1000

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  try {
    const body = await req.json().catch(() => null)
    const userId = String(body?.user_id ?? '')
    const payload = body?.payload

    if (!UUID.test(userId) || payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
      return json(req, 400, { error: 'user_id (uuid) and a payload object are required' })
    }
    if (JSON.stringify(payload).length > MAX_PAYLOAD_BYTES) {
      return json(req, 413, { error: 'payload too large' })
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Only a real, still-unconfirmed, freshly created account may be written to.
    const { data: found, error: lookupError } = await admin.auth.admin.getUserById(userId)
    const target = found?.user
    if (lookupError || !target) return json(req, 404, { error: 'Unknown user' })
    if (target.email_confirmed_at || target.confirmed_at) return json(req, 403, { error: 'Account already confirmed' })
    if (Date.now() - new Date(target.created_at).getTime() > MAX_ACCOUNT_AGE_MS) {
      return json(req, 403, { error: 'Account too old' })
    }

    const { error } = await admin.auth.admin.updateUserById(userId, {
      user_metadata: { ...(target.user_metadata ?? {}), reg_pending: payload },
    })

    if (error) {
      console.error('store-reg-pending error:', error)
      return json(req, 500, { error: 'Could not store registration' })
    }

    return json(req, 200, { ok: true })
  } catch (err) {
    console.error('store-reg-pending error:', err)
    return json(req, 500, { error: 'Internal error' })
  }
})
