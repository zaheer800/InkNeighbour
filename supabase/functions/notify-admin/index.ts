/**
 * InkNeighbour — notify-admin Edge Function
 *
 * Sends an email to the admin when a new shop application is submitted.
 * Called from the frontend after successful owner record creation.
 *
 * Environment variables required (set via Supabase Dashboard → Edge Functions → Secrets):
 *   RESEND_API_KEY       — Resend API key
 *   ADMIN_EMAIL          — override recipient (defaults to info@zakapedia.in)
 *   FROM_EMAIL           — sender address on your verified Resend domain
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ShopApplicationPayload {
  owner_name: string
  shop_name: string
  society_name: string
  email: string
  phone: string
  admin_url: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const payload = (await req.json()) as ShopApplicationPayload

    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    if (!resendApiKey) {
      console.error('RESEND_API_KEY not set')
      return new Response(JSON.stringify({ error: 'Email not configured' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      })
    }

    const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'info@zakapedia.in'
    const fromEmail  = Deno.env.get('FROM_EMAIL')  || 'InkNeighbour <admin@inkneighbour.zakapedia.in>'

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
            <strong>${payload.owner_name}</strong> has submitted a new shop application and is awaiting your approval.
          </p>
          <table style="width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 15px;">
            <tr><td style="padding: 8px 0; color: #6B7280; width: 40%;">Shop name</td><td style="padding: 8px 0; font-weight: 600;">${payload.shop_name}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Society</td><td style="padding: 8px 0; font-weight: 600;">${payload.society_name}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Email</td><td style="padding: 8px 0;">${payload.email}</td></tr>
            <tr><td style="padding: 8px 0; color: #6B7280;">Phone</td><td style="padding: 8px 0;">${payload.phone}</td></tr>
          </table>
          <a href="${payload.admin_url}" style="display: block; background: #7C3AED; color: #fff; text-align: center; padding: 14px 24px; border-radius: 12px; font-weight: 700; font-size: 15px; text-decoration: none;">
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
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [adminEmail],
        subject: `New shop application — ${payload.shop_name} (${payload.society_name})`,
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

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-admin error:', err)
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }
})
