import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { deleteJobFile } from '../lib/storage'
import { useOwner } from './useOwner'

/**
 * Hook for job management — fetch, accept, update status.
 * On fetch: auto-cancels any submitted jobs whose sla_deadline has passed.
 * All mutations co-located here per architectural guidelines.
 */
export function useJobs() {
  const { owner } = useOwner()
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchJobs = useCallback(async () => {
    if (!owner) { setJobs([]); setLoading(false); return }

    setLoading(true)
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })

    if (error) {
      setError(error)
      setLoading(false)
      return
    }

    const allJobs = data || []

    // Auto-cancel SLA-expired submitted jobs
    const now = new Date()
    const expired = allJobs.filter(
      j => j.status === 'submitted'
        && j.sla_deadline
        && new Date(j.sla_deadline) < now
    )

    if (expired.length > 0) {
      await Promise.all(
        expired.map(async j => {
          await supabase
            .from('jobs')
            .update({ status: 'cancelled' })
            .eq('id', j.id)
          await deleteJobFile(j.id)
        })
      )
      // Re-fetch after auto-cancellation so UI reflects final state
      const { data: refreshed } = await supabase
        .from('jobs')
        .select('*')
        .eq('owner_id', owner.id)
        .order('created_at', { ascending: false })
      setJobs(refreshed || [])
    } else {
      setJobs(allJobs)
    }

    setLoading(false)
  }, [owner])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

  const updateJobStatus = useCallback(async (jobId, status) => {
    const { data, error } = await supabase
      .from('jobs')
      .update({ status })
      .eq('id', jobId)
      .select()
      .single()

    if (error) return { error }

    // Auto-delete file on delivered or cancelled
    if (status === 'delivered' || status === 'cancelled') {
      await deleteJobFile(jobId)
    }

    setJobs(prev => prev.map(j => j.id === jobId ? data : j))
    return { data }
  }, [])

  const acceptJob = useCallback((jobId) => updateJobStatus(jobId, 'accepted'), [updateJobStatus])
  const markPrinting = useCallback((jobId) => updateJobStatus(jobId, 'printing'), [updateJobStatus])
  const markDelivered = useCallback((jobId) => updateJobStatus(jobId, 'delivered'), [updateJobStatus])
  const cancelJob = useCallback((jobId) => updateJobStatus(jobId, 'cancelled'), [updateJobStatus])

  const getSignedUrl = useCallback(async (filePath) => {
    const { data, error } = await supabase.storage
      .from('job-files')
      .createSignedUrl(filePath, 60 * 10) // 10 minutes
    return { url: data?.signedUrl, error }
  }, [])

  return {
    jobs,
    loading,
    error,
    fetchJobs,
    acceptJob,
    markPrinting,
    markDelivered,
    cancelJob,
    getSignedUrl
  }
}
