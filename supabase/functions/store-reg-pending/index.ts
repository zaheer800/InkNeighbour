/**
 * InkNeighbour — store-reg-pending Edge Function
 *
 * Persists the pending owner registration payload into the auth user's
 * metadata so it survives cross-device email confirmation flows.
 * Called from the frontend immediately after signUp() in the deferred path
 * (when email confirmation is enabled and there is no session yet).
 *
 * No JWT auth required — the caller provides user_id explicitly and has
 * no session token yet (email unconfirmed). The function validates that
 * the user_id matches a real user before writing.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const { user_id, payload } = await req.json()

    if (!user_id || !payload) {
      return new Response(JSON.stringify({ error: 'user_id and payload required' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl     = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { error } = await admin.auth.admin.updateUserById(user_id, {
      user_metadata: { reg_pending: payload }
    })

    if (error) {
      console.error('store-reg-pending error:', error)
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('store-reg-pending error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
