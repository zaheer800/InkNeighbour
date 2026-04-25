/**
 * InkNeighbour — notify-owner Edge Function
 *
 * Sends an email to a shop owner (e.g. rejection notice).
 * Uses the service role key to look up the owner's email from auth.users.
 *
 * Environment variables:
 *   RESEND_API_KEY  — Resend API key with send access on inkneighbour.zakapedia.in
 *   FROM_EMAIL      — defaults to InkNeighbour <admin@inkneighbour.zakapedia.in>
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface NotifyOwnerPayload {
  owner_id: string
  type: 'rejected'
  shop_name: string
  society_name: string
  support_email: string
  support_whatsapp?: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const payload = (await req.json()) as NotifyOwnerPayload

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    // Use service role to look up owner email from auth.users
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: ownerRow } = await supabase
      .from('owners')
      .select('user_id, name')
      .eq('id', payload.owner_id)
      .single()

    if (!ownerRow) {
      return new Response(JSON.stringify({ error: 'Owner not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const { data: { user } } = await supabase.auth.admin.getUserById(ownerRow.user_id)
    if (!user?.email) {
      return new Response(JSON.stringify({ error: 'Owner email not found' }), {
        status: 404,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const fromEmail = Deno.env.get('FROM_EMAIL') || 'InkNeighbour <admin@inkneighbour.zakapedia.in>'
    const firstName = ownerRow.name.split(' ')[0]

    const supportLine = payload.support_whatsapp
      ? `<a href="https://wa.me/${payload.support_whatsapp}" style="color:#7C3AED;">WhatsApp us</a> or email <a href="mailto:${payload.support_email}" style="color:#7C3AED;">${payload.support_email}</a>`
      : `email us at <a href="mailto:${payload.support_email}" style="color:#7C3AED;">${payload.support_email}</a>`

    const html = `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; color: #0A0A0F;">
        <div style="background: linear-gradient(160deg,#1A1A2E 0%,#2D1B69 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; font-size: 22px; margin: 0;">
            Ink<span style="color: #FF6B35;">Neighbour</span>
          </h1>
          <p style="color: rgba(255,255,255,0.6); margin: 8px 0 0; font-size: 14px;">Shop application update</p>
        </div>
        <div style="background: #fff; padding: 32px; border-radius: 0 0 16px 16px; border: 1px solid #E5E7EB; border-top: none;">
          <p style="font-size: 16px; margin-top: 0;">Hi <strong>${firstName}</strong>,</p>
          <p style="font-size: 16px; color: #374151;">
            Thank you for applying to InkNeighbour. Unfortunately, your shop application for
            <strong>${payload.shop_name}</strong> (${payload.society_name}) has not been approved at this time.
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
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [user.email],
        subject: `Your InkNeighbour shop application — ${payload.shop_name}`,
        html,
      }),
    })

    if (!emailRes.ok) {
      const err = await emailRes.text()
      console.error('Resend error:', err)
      return new Response(JSON.stringify({ error: 'Email send failed', detail: err }), {
        status: 502,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ sent: true, to: user.email }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-owner error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
