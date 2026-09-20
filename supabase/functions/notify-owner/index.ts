/**
 * InkNeighbour — notify-owner Edge Function
 *
 * Sends an email to a shop owner (currently: the rejection notice).
 * Called from the admin screen right after the admin rejects an application.
 *
 * Hardened 2026-09-20:
 *  - Only the admin (signed in, confirmed email = ADMIN_EMAIL) may call it. Before this,
 *    anyone with the public key could send emails to any owner id.
 *  - The shop and society names come from the database, only for an owner whose
 *    status is really 'inactive' (rejected), not from the request body.
 *  - HTML-escaped; CORS limited to the app's origins; Resend errors are not echoed back;
 *    Reply-To is the admin address (mail.zakapedia.in has no inbox).
 *
 * Environment variables (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY   — Resend API key
 *   ADMIN_EMAIL      — the admin (defaults to info@zakapedia.in); also the support/reply address
 *   FROM_EMAIL       — sender on the verified Resend domain
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

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Only the admin may send owner notices.
    const adminEmail = (Deno.env.get('ADMIN_EMAIL') || 'info@zakapedia.in').toLowerCase()
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData, error: userError } = token
      ? await admin.auth.getUser(token)
      : { data: { user: null }, error: new Error('no token') }
    const caller = userData?.user
    if (userError || !caller || caller.is_anonymous) return json(req, 401, { error: 'Sign in required' })
    if (!caller.email_confirmed_at || (caller.email ?? '').toLowerCase() !== adminEmail) {
      return json(req, 403, { error: 'Admin only' })
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) return json(req, 500, { error: 'Email not configured' })

    const body = await req.json().catch(() => ({}))
    const ownerId = String(body?.owner_id ?? '')
    if (!UUID.test(ownerId) || body?.type !== 'rejected') {
      return json(req, 400, { error: 'owner_id (uuid) and type "rejected" are required' })
    }

    const { data: ownerRow } = await admin
      .from('owners')
      .select('user_id, name, shop_name, status, locality, societies(name)')
      .eq('id', ownerId)
      .maybeSingle()

    if (!ownerRow) return json(req, 404, { error: 'Owner not found' })
    if (ownerRow.status !== 'inactive') return json(req, 409, { error: 'Application is not rejected' })
    if (!ownerRow.user_id) return json(req, 404, { error: 'Owner has no account' })

    const { data: ownerUser } = await admin.auth.admin.getUserById(ownerRow.user_id)
    const ownerEmail = ownerUser?.user?.email
    if (!ownerEmail) return json(req, 404, { error: 'Owner email not found' })

    const shopName = ownerRow.shop_name || ownerRow.name
    const societyName = (ownerRow as { societies?: { name?: string } | null }).societies?.name || ownerRow.locality || ''
    const firstName = String(ownerRow.name || '').split(' ')[0]
    const supportEmail = adminEmail
    const supportWhatsapp = /^[0-9]{8,15}$/.test(String(body?.support_whatsapp ?? '')) ? String(body.support_whatsapp) : ''
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'InkNeighbour <inkneighbour@mail.zakapedia.in>'

    const supportLine = supportWhatsapp
      ? `<a href="https://wa.me/${supportWhatsapp}" style="color:#7C3AED;">WhatsApp us</a> or email <a href="mailto:${esc(supportEmail)}" style="color:#7C3AED;">${esc(supportEmail)}</a>`
      : `email us at <a href="mailto:${esc(supportEmail)}" style="color:#7C3AED;">${esc(supportEmail)}</a>`

    const html = `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; color: #0A0A0F;">
        <div style="background: linear-gradient(160deg,#1A1A2E 0%,#2D1B69 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; font-size: 22px; margin: 0;">
            Ink<span style="color: #FF6B35;">Neighbour</span>
          </h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Shop application update</p>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">Hi <strong>${esc(firstName)}</strong>,</p>
          <p style="font-size: 16px; color: #374151;">
            Thank you for applying to InkNeighbour. Unfortunately, your shop application for
            <strong>${esc(shopName)}</strong> (${esc(societyName)}) has not been approved at this time.
          </p>
          <p style="font-size: 15px; color: #6B7280;">
            If you believe this is a mistake or would like more information, please ${supportLine}.
          </p>
          <p style="font-size: 15px; color: #6B7280; margin-bottom: 0;">
            Thank you for your interest in InkNeighbour.
          </p>
        </div>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [ownerEmail],
        reply_to: [supportEmail],
        subject: `Your InkNeighbour shop application — ${shopName}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      console.error('Resend error:', await emailRes.text())
      return json(req, 502, { error: 'Email send failed' })
    }

    return json(req, 200, { sent: true })
  } catch (err) {
    console.error('notify-owner error:', err)
    return json(req, 500, { error: 'Internal error' })
  }
})
