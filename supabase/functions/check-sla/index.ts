/**
 * InkNeighbour — check-sla Edge Function
 *
 * Runs on a schedule (every 1–5 minutes via Supabase cron or external trigger).
 * Performs three actions:
 *
 * 1. AUTO-CANCEL: Finds submitted jobs where sla_deadline has passed,
 *    cancels them, and triggers soft-lock check for the owner.
 *
 * 2. ESCALATION REMINDERS: Sends push notifications at 10-min and 5-min marks
 *    to warn the owner a job is about to expire.
 *
 * 3. SOFT LOCK: After auto-cancelling, checks if the owner's reliability
 *    score has dropped below the threshold and applies a 24h lock.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const SOFT_LOCK_THRESHOLD = 70   // reliability score % below which soft lock applies
const SLA_MINUTES = 15

Deno.serve(async (_req) => {
  try {
    const now = new Date()

    // ----------------------------------------------------------------
    // 1. ESCALATION REMINDERS
    // Send push to owner for jobs approaching SLA deadline
    // ----------------------------------------------------------------
    const fiveMinMark = new Date(now.getTime() + 5 * 60 * 1000)
    const tenMinMark = new Date(now.getTime() + 10 * 60 * 1000)

    const { data: urgentJobs } = await supabase
      .from('jobs')
      .select('id, job_number, owner_id, sla_deadline')
      .eq('status', 'submitted')
      .lte('sla_deadline', tenMinMark.toISOString())
      .gt('sla_deadline', now.toISOString())

    if (urgentJobs?.length) {
      for (const job of urgentJobs) {
        const minutesLeft = Math.floor(
          (new Date(job.sla_deadline).getTime() - now.getTime()) / 60000
        )

        // Send reminder at ~10 min and ~5 min marks
        if (minutesLeft <= 10 && minutesLeft > 5) {
          await sendOwnerPush(job.owner_id, {
            title: 'Job waiting — 10 min left',
            body: `${job.job_number} needs your response in ${minutesLeft} minutes or it will be auto-cancelled.`,
            url: '/dashboard'
          })
        } else if (minutesLeft <= 5) {
          await sendOwnerPush(job.owner_id, {
            title: '⚠️ Urgent — 5 min left!',
            body: `${job.job_number} will be auto-cancelled in ${minutesLeft} minutes!`,
            url: '/dashboard'
          })
        }
      }
    }

    // ----------------------------------------------------------------
    // 2. AUTO-CANCEL expired jobs
    // ----------------------------------------------------------------
    const { data: expiredJobs } = await supabase
      .from('jobs')
      .select('id, job_number, owner_id, file_path')
      .eq('status', 'submitted')
      .lt('sla_deadline', now.toISOString())

    const cancelledOwners = new Set<string>()

    if (expiredJobs?.length) {
      for (const job of expiredJobs) {
        // Cancel the job
        await supabase
          .from('jobs')
          .update({ status: 'cancelled' })
          .eq('id', job.id)

        // Record missed job for reliability scoring and audit
        if (job.owner_id) {
          await supabase
            .from('missed_jobs')
            .insert({ job_id: job.id, owner_id: job.owner_id, reason: 'sla_expired' })
        }

        // Delete file from storage
        if (job.file_path) {
          await supabase.storage
            .from('job-files')
            .remove([job.file_path])
        }

        if (job.owner_id) {
          cancelledOwners.add(job.owner_id)
        }
      }

      console.log(`Auto-cancelled ${expiredJobs.length} expired job(s)`)
    }

    // ----------------------------------------------------------------
    // 3. SOFT LOCK CHECK
    // After cancellations, check each affected owner's reliability score
    // ----------------------------------------------------------------
    for (const ownerId of cancelledOwners) {
      const { data: rel } = await supabase
        .from('owner_reliability')
        .select('reliability_score, total_jobs')
        .eq('owner_id', ownerId)
        .single()

      if (!rel) continue

      const score = rel.reliability_score != null ? parseFloat(rel.reliability_score) : null
      const hasEnoughData = rel.total_jobs >= 5

      if (hasEnoughData && score !== null && score < SOFT_LOCK_THRESHOLD) {
        // Apply 24-hour soft lock
        await supabase.rpc('apply_soft_lock', { p_owner_id: ownerId })

        // Notify owner
        await sendOwnerPush(ownerId, {
          title: 'Your shop has been paused',
          body: `Your reliability score dropped to ${score}%. Your shop will be automatically unpaused after 24 hours.`,
          url: '/dashboard'
        })

        console.log(`Soft lock applied to owner ${ownerId} (score: ${score}%)`)
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        expired: expiredJobs?.length ?? 0,
        urgent_reminders: urgentJobs?.length ?? 0,
        soft_locked: cancelledOwners.size
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('check-sla error:', err)
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ----------------------------------------------------------------
// Helper: send push notification to all of an owner's devices
// ----------------------------------------------------------------
async function sendOwnerPush(
  ownerId: string,
  payload: { title: string; body: string; url: string }
): Promise<void> {
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('owner_id', ownerId)

  if (!subs?.length) return

  // Log intent — full VAPID push signing is Phase 2
  // In production, use web-push library with VAPID keys to sign and send
  console.log(`[push] ${subs.length} device(s) for owner ${ownerId}:`, payload.title)

  // TODO (Phase 2): Replace with actual VAPID push delivery
  // for (const { subscription } of subs) {
  //   await webpush.sendNotification(subscription, JSON.stringify(payload), vapidOptions)
  // }
}
