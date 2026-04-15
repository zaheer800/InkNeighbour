import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useOwner } from './useOwner'

/**
 * Fetches and computes reliability metrics for the current owner
 * from the owner_reliability view (computed in Postgres).
 *
 * Returns:
 *   reliability  — full row from owner_reliability view
 *   score        — 0-100 numeric, or null if < 5 jobs
 *   grade        — 'green' | 'amber' | 'red' based on score
 *   isSoftLocked — true if soft_lock_until is in the future
 */
export function useReliability() {
  const { owner } = useOwner()
  const [reliability, setReliability] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchReliability = useCallback(async () => {
    if (!owner) { setReliability(null); setLoading(false); return }

    setLoading(true)
    const { data, error } = await supabase
      .from('owner_reliability')
      .select('*')
      .eq('owner_id', owner.id)
      .single()

    if (error) {
      setError(error)
    } else {
      setReliability(data)
    }
    setLoading(false)
  }, [owner])

  useEffect(() => {
    fetchReliability()
  }, [fetchReliability])

  const score = reliability?.reliability_score != null
    ? parseFloat(reliability.reliability_score)
    : null

  // Only show grade once there are enough data points (5+ jobs with SLA)
  const hasEnoughData = reliability?.total_jobs >= 5

  const grade = hasEnoughData && score != null
    ? score >= 90 ? 'green'
    : score >= 70 ? 'amber'
    : 'red'
    : null

  const isSoftLocked = reliability?.soft_lock_until
    ? new Date(reliability.soft_lock_until) > new Date()
    : false

  const activeJobsCount = reliability?.active_jobs_count ?? 0
  const maxActiveJobs = reliability?.max_active_jobs ?? 3
  const isAtJobLimit = activeJobsCount >= maxActiveJobs

  const acceptanceRate = reliability?.acceptance_rate != null
    ? parseFloat(reliability.acceptance_rate)
    : null

  const completionRate = reliability?.completion_rate != null
    ? parseFloat(reliability.completion_rate)
    : null

  const streak = reliability?.streak ?? 0

  const avgResponseMinutes = reliability?.avg_response_minutes != null
    ? parseFloat(reliability.avg_response_minutes)
    : null

  return {
    reliability,
    score,
    grade,
    hasEnoughData,
    isSoftLocked,
    isAtJobLimit,
    activeJobsCount,
    maxActiveJobs,
    acceptanceRate,
    completionRate,
    streak,
    avgResponseMinutes,
    loading,
    error,
    refetch: fetchReliability
  }
}
