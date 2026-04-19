import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Hook for Owner profile — fetch, update, toggle status.
 * Enforces soft lock (prevents going live when locked)
 * and exposes job limit info for consumers.
 */
export function useOwner() {
  const { user } = useAuth()
  const [owner, setOwner] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchOwner = useCallback(async () => {
    if (!user) { setOwner(null); setLoading(false); return }

    setLoading(true)
    const { data, error } = await supabase
      .from('owners')
      .select(`*, societies(*)`)
      .eq('user_id', user.id)
      .single()

    if (error) {
      // PGRST116 = no row found — user exists in auth but has no owner record yet
      // (e.g. registration failed mid-way due to email confirmation being enabled).
      // Treat as null owner, not a hard error — UI handles this case explicitly.
      if (error.code !== 'PGRST116') setError(error)
      // owner stays null — dashboard will show "setup incomplete" banner
    } else {
      setOwner(data)
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchOwner()
  }, [fetchOwner])

  // Poll every 30 s while pending so the dashboard auto-updates after admin approves
  useEffect(() => {
    if (owner?.status !== 'pending') return
    const id = setInterval(fetchOwner, 30000)
    return () => clearInterval(id)
  }, [owner?.status, fetchOwner])

  const updateOwner = useCallback(async (updates) => {
    if (!owner) return { error: new Error('No owner record') }

    const { data, error } = await supabase
      .from('owners')
      .update(updates)
      .eq('id', owner.id)
      .select(`*, societies(*)`)
      .single()

    if (!error) setOwner(data)
    return { data, error }
  }, [owner])

  /**
   * Toggle shop status active ↔ paused.
   * Returns { blocked: 'soft_lock' } if the owner is currently soft-locked.
   * Callers should show PreCommitmentPrompt before calling this when going active.
   */
  const toggleStatus = useCallback(async () => {
    if (!owner) return { error: new Error('No owner record') }

    // Cannot toggle until admin approves the shop
    if (owner.status === 'pending') return { error: new Error('Shop awaiting admin approval') }

    // Prevent going live if soft-locked
    if (owner.status !== 'active' && owner.soft_lock_until) {
      const lockExpiry = new Date(owner.soft_lock_until)
      if (lockExpiry > new Date()) {
        return { blocked: 'soft_lock', until: lockExpiry }
      }
    }

    const newStatus = owner.status === 'active' ? 'paused' : 'active'
    return updateOwner({ status: newStatus })
  }, [owner, updateOwner])

  /**
   * Check whether the owner can accept a new job given their active job limit.
   * Returns true if accepting is allowed.
   */
  const canAcceptNewJob = useCallback(async () => {
    if (!owner) return false

    const { count } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', owner.id)
      .in('status', ['submitted', 'accepted', 'printing'])

    const limit = owner.max_active_jobs ?? 3
    return (count ?? 0) < limit
  }, [owner])

  const isSoftLocked = owner?.soft_lock_until
    ? new Date(owner.soft_lock_until) > new Date()
    : false

  return {
    owner,
    loading,
    error,
    isSoftLocked,
    fetchOwner,
    updateOwner,
    toggleStatus,
    canAcceptNewJob
  }
}
