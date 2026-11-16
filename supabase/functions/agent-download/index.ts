/**
 * InkNeighbour — agent-download Edge Function
 *
 * Gives a signed-in user a short-lived link to the InkNeighbour Connect Windows installer zip, which
 * lives in the private "agent-releases" bucket. Anonymous callers (including the public anon key) get 401.
 *
 * Deploy with verify_jwt = true. Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (auto-provided).
 * ALLOWED_ORIGINS (optional): comma-separated browser origins allowed to call this.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'agent-releases'
const OBJECT = 'InkNeighbourConnect-win-x64.zip'
const LINK_SECONDS = 60

const ALLOWED_ORIGINS = (
  Deno.env.get('ALLOWED_ORIGINS') ?? 'https://inkneighbour.zakapedia.in,http://localhost:5173'
).split(',').map((s) => s.trim()).filter(Boolean)

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
})

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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'method_not_allowed' })

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json(req, 401, { error: 'unauthorized' })
  const { data: { user }, error: authError } = await db.auth.getUser(token)
  if (authError || !user) return json(req, 401, { error: 'unauthorized' })

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(OBJECT, LINK_SECONDS, { download: OBJECT })
  if (error || !data?.signedUrl) return json(req, 404, { error: 'not_available' })
  return json(req, 200, { url: data.signedUrl, expires_in: LINK_SECONDS })
})
