import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

/**
 * Hook for Owner profile — fetch, update, toggle status.
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

    if (error) setError(error)
    else setOwner(data)
    setLoading(false)
  }, [user])

  useEffect(() => {
    fetchOwner()
  }, [fetchOwner])

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

  const toggleStatus = useCallback(async () => {
    if (!owner) return
    const newStatus = owner.status === 'active' ? 'paused' : 'active'
    return updateOwner({ status: newStatus })
  }, [owner, updateOwner])

  return { owner, loading, error, fetchOwner, updateOwner, toggleStatus }
}
