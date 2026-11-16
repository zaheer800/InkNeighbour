import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'

const REFRESH_MS = 30 * 1000

/**
 * Printer management data for the signed-in user. Read-only from the browser except the narrow
 * RPCs and the rename/threshold/remove actions that RLS allows. Polls every 30 s (no Realtime in Phase 1).
 */
export function usePrinters() {
  const { user } = useAuth()
  const [accountId, setAccountId] = useState(null)
  const accountRef = useRef(null)
  const [agents, setAgents] = useState([])
  const [printers, setPrinters] = useState([])
  const [consumables, setConsumables] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    let account = accountRef.current
    if (!account) {
      const { data, error: e } = await supabase.rpc('ensure_personal_printer_account')
      if (e) { setError(e); setLoading(false); return }
      account = data
      accountRef.current = data
      setAccountId(data)
    }
    const [a, p, al] = await Promise.all([
      supabase.from('printer_agents')
        .select('id, device_name, agent_version, status, last_heartbeat_at, paired_at')
        .eq('account_id', account).order('paired_at', { ascending: false }),
      supabase.from('printers').select('*').eq('account_id', account).order('created_at'),
      supabase.from('printer_alerts').select('*').eq('account_id', account)
        .in('status', ['open', 'acknowledged']).order('created_at', { ascending: false }),
    ])
    const printerIds = (p.data ?? []).map((x) => x.id)
    const c = printerIds.length
      ? await supabase.from('printer_current_consumables').select('*').in('printer_id', printerIds)
      : { data: [], error: null }
    const firstError = a.error || p.error || c.error || al.error
    setError(firstError ?? null)
    if (!firstError) {
      setAgents(a.data ?? [])
      setPrinters(p.data ?? [])
      setConsumables(c.data ?? [])
      setAlerts(al.data ?? [])
    }
    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
    const id = setInterval(load, REFRESH_MS)
    return () => clearInterval(id)
  }, [load])

  const createPairingCode = useCallback(async () => {
    const { data, error: e } = await supabase.rpc('create_printer_pairing_code', { p_account: accountId })
    return { code: data, error: e }
  }, [accountId])

  const revokeAgent = useCallback(async (agentId) => {
    const { error: e } = await supabase.rpc('revoke_printer_agent', { p_agent: agentId })
    if (!e) await load()
    return { error: e }
  }, [load])

  const updatePrinter = useCallback(async (id, patch) => {
    const { data, error: e } = await supabase.from('printers').update(patch).eq('id', id).select('id')
    const err = e ?? (data && data.length === 0 ? new Error('not_allowed') : null)
    if (!err) await load()
    return { error: err }
  }, [load])

  const removePrinter = useCallback(async (id) => {
    const { data, error: e } = await supabase.from('printers').delete().eq('id', id).select('id')
    const err = e ?? (data && data.length === 0 ? new Error('not_allowed') : null)
    if (!err) await load()
    return { error: err }
  }, [load])

  const acknowledgeAlert = useCallback(async (id) => {
    const { error: e } = await supabase.rpc('acknowledge_printer_alert', { p_alert: id })
    if (!e) await load()
    return { error: e }
  }, [load])

  return {
    accountId, agents, printers, consumables, alerts, loading, error,
    refresh: load, createPairingCode, revokeAgent, updatePrinter, removePrinter, acknowledgeAlert,
  }
}
