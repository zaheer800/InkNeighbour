/**
 * InkNeighbour — notify-admin Edge Function
 *
 * Sends an email to the admin when a new shop application is submitted.
 * Called from the frontend after the applicant's owner record is created.
 *
 * Hardened 2026-09-20:
 *  - Caller must be a signed-in user (the anon key alone is rejected).
 *  - The email is built from the caller's OWN pending application in the database,
 *    not from text sent by the browser, so it cannot be used to send arbitrary
 *    content to the admin or to spam it for other people.
 *  - HTML-escaped; CORS limited to the app's origins; Resend errors are not echoed back.
 *
 * Environment variables (Supabase → Edge Functions → Secrets):
 *   RESEND_API_KEY   — Resend API key
 *   ADMIN_EMAIL      — recipient (defaults to info@zakapedia.in)
 *   FROM_EMAIL       — sender on the verified Resend domain
 *   APP_URL          — public app URL used for the admin link
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'Method not allowed' })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Who is calling? The anon key is a valid JWT but not a user, so getUser() rejects it.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: userData, error: userError } = token
      ? await admin.auth.getUser(token)
      : { data: { user: null }, error: new Error('no token') }
    const user = userData?.user
    if (userError || !user || user.is_anonymous) return json(req, 401, { error: 'Sign in required' })

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set')
      return json(req, 500, { error: 'Email not configured' })
    }

    // The applicant's own newest pending application, straight from the database.
    const { data: owner } = await admin
      .from('owners')
      .select('name, shop_name, phone, locality, created_at, societies(name)')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!owner) return json(req, 404, { error: 'No pending application' })
    if (Date.now() - new Date(owner.created_at).getTime() > 24 * 60 * 60 * 1000) {
      return json(req, 409, { error: 'Application is too old to notify about' })
    }

    const societyName = (owner as { societies?: { name?: string } | null }).societies?.name || owner.locality || ''
    const shopName = owner.shop_name || owner.name
    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'info@zakapedia.in'
    const fromEmail = Deno.env.get('FROM_EMAIL') || 'InkNeighbour <inkneighbour@mail.zakapedia.in>'
    const appUrl = (Deno.env.get('APP_URL') || 'https://inkneighbour.zakapedia.in').replace(/\/$/, '')

    const html = `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; color: #0A0A0F;">
        <div style="background: linear-gradient(160deg,#1A1A2E 0%,#2D1B69 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; font-size: 22px; margin: 0;">
            Ink<span style="color: #FF6B35;">Neighbour</span>
          </h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">New shop application</p>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">
            <strong>${esc(owner.name)}</strong> has submitted a new shop application and is awaiting your approval.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 15px;">
            <tr><td style="padding: 8px 0; color: #6B7280; width: 40%;">Shop name</td><td style="padding: 8px 0; font-weight: 600;">${esc(shopName)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Society</td><td style="padding: 8px 0; font-weight: 600;">${esc(societyName)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Email</td><td style="padding: 8px 0;">${esc(user.email)}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Phone</td><td style="padding: 8px 0;">${esc(owner.phone)}</td></tr>
          </table>
          <a href="${esc(appUrl)}/admin" style="display: block; background: #7C3AED; color: #fff; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none;">
            Review application →
          </a>
          <p style="font-size: 13px; color: #6B7280; margin-top: 24px; margin-bottom: 0;">
            You're receiving this because you're the InkNeighbour admin.
          </p>
        </div>
      </div>
    `

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `New shop application — ${shopName} (${societyName})`,
        html,
      }),
    })

    if (!emailRes.ok) {
      console.error('Resend error:', await emailRes.text())
      return json(req, 502, { error: 'Email send failed' })
    }

    return json(req, 200, { sent: true })
  } catch (err) {
    console.error('notify-admin error:', err)
    return json(req, 500, { error: 'Internal error' })
  }
})
