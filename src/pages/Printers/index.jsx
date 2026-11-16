import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, Monitor, Plus, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { usePrinters } from '../../hooks/usePrinters'
import {
  STALE_AFTER_MS, describeConsumable, filterPrinters, formatPairingCode, printerLiveState, timeAgo,
} from '../../lib/printers'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import Card from '../../components/ui/Card'
import Modal from '../../components/ui/Modal'
import AppNav from '../../components/AppNav'
import DashboardNav from '../../components/DashboardNav'

const STATE_BADGE = {
  ready: 'green', busy: 'violet', error: 'red', offline: 'red',
  agent_offline: 'amber', disconnected: 'muted', unknown: 'muted',
}
const FILTERS = ['all', 'online', 'offline', 'attention', 'low_supplies']
const FILTER_LABEL = { low_supplies: 'low' }
const REMOVE_CLS = 'min-h-[48px] px-4 rounded-[14px] font-bold text-red hover:bg-red/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-red/40'
const THRESHOLDS = [10, 15, 25, 40]

function SupplyBar({ c, threshold, t }) {
  const d = describeConsumable(c, threshold)
  const colourLabel = t(`printers.colour_${d.colour}`)
  const typeLabel = t(`printers.type_${d.type}`)
  const bar = d.low ? 'bg-red' : 'bg-green'
  return (
    <li className="py-2.5">
      <div className="flex items-center justify-between gap-3 text-base">
        <span className="font-semibold text-ink whitespace-nowrap">{colourLabel} {typeLabel}</span>
        {d.unavailable
          ? <span className="text-sm text-muted text-right">{t('printers.supply_unavailable')}</span>
          : <span className="font-bold text-ink">{d.percent}%</span>}
      </div>
      {!d.unavailable && (
        <div
          className="h-2.5 rounded-pill bg-border overflow-hidden mt-1.5"
          role="progressbar" aria-valuenow={d.percent} aria-valuemin={0} aria-valuemax={100}
          aria-label={`${colourLabel} ${typeLabel}`}
        >
          <div className={`h-full ${bar}`} style={{ width: `${d.percent}%` }} />
        </div>
      )}
      <div className="flex flex-wrap gap-x-3 text-sm text-muted mt-1 empty:hidden">
        {!d.unavailable && d.source !== 'actual' && <span>{t(`printers.source_${d.source}`)}</span>}
        {d.low && <span className="font-semibold text-red">{t('printers.supply_low')}</span>}
        {d.stale && !d.unavailable && <span className="font-semibold text-amber">{t('printers.supply_old')}</span>}
      </div>
    </li>
  )
}

function PrinterCard({ printer, agent, supplies, t, onSave, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(printer.name)
  const [threshold, setThreshold] = useState(printer.low_supply_threshold)
  const state = printerLiveState(printer, agent)
  const seen = timeAgo(printer.last_seen_at)
  const showQueue = (state === 'ready' || state === 'busy') && Number.isInteger(printer.queued_jobs)
  const makeModel = [printer.manufacturer, printer.model].filter(Boolean).join(' ')

  async function save(e) {
    e.preventDefault()
    if (!name.trim()) return
    const ok = await onSave(printer.id, { name: name.trim(), low_supply_threshold: Number(threshold) })
    if (ok) setEditing(false)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold text-ink break-words">{printer.name}</h3>
          {makeModel && makeModel !== printer.name && (
            <p className="text-base text-muted break-words">{makeModel}</p>
          )}
          {seen && (
            <p className="text-sm text-muted mt-0.5">
              {t('printers.last_seen', { when: seen })}
              {showQueue && <> · <span className="font-semibold text-ink">{t('printers.queue', { count: printer.queued_jobs })}</span></>}
            </p>
          )}
        </div>
        <Badge label={t(`printers.state_${state}`)} variant={STATE_BADGE[state]} className="shrink-0 whitespace-nowrap" />
      </div>
      {printer.status_detail && state === 'error' && (
        <p className="text-base text-red mt-2 break-words">{printer.status_detail}</p>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-sm font-semibold text-muted uppercase tracking-wide">{t('printers.supplies')}</p>
        {supplies.length === 0
          ? <p className="text-base text-muted py-2">{t('printers.supply_unavailable')}</p>
          : <ul>{supplies.map((c) => <SupplyBar key={`${c.consumable_type}:${c.colour}`} c={c} threshold={printer.low_supply_threshold} t={t} />)}</ul>}
      </div>

      {editing ? (
        <form onSubmit={save} className="mt-4 space-y-3">
          <label className="block text-base font-semibold text-ink">
            {t('printers.name_label')}
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required
              className="mt-1 w-full min-h-[52px] rounded-xl border border-border px-4 text-base"
            />
          </label>
          <label className="block text-base font-semibold text-ink">
            {t('printers.warn_label')}
            <select
              value={threshold} onChange={(e) => setThreshold(e.target.value)}
              className="mt-1 w-full min-h-[52px] rounded-xl border border-border px-4 text-base bg-surface"
            >
              {[...new Set([...THRESHOLDS, Number(printer.low_supply_threshold)])].sort((a, b) => a - b).map((v) => <option key={v} value={v}>{v}%</option>)}
            </select>
          </label>
          <div className="flex gap-3">
            <Button type="submit" variant="secondary" size="md">{t('printers.save')}</Button>
            <Button variant="muted" size="md" onClick={() => { setName(printer.name); setThreshold(printer.low_supply_threshold); setEditing(false) }}>{t('printers.cancel')}</Button>
          </div>
        </form>
      ) : (
        <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
          <Button variant="ghost" size="md" onClick={() => setEditing(true)}>{t('printers.rename')}</Button>
          <button type="button" className={REMOVE_CLS} onClick={() => onRemove(printer)}>{t('printers.remove')}</button>
        </div>
      )}
    </Card>
  )
}

export default function Printers() {
  const { t } = useTranslation()
  const p = usePrinters()
  const [filter, setFilter] = useState('all')
  const [pairing, setPairing] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const agentsById = Object.fromEntries(p.agents.map((a) => [a.id, a]))
  const consumablesByPrinter = {}
  for (const c of p.consumables) (consumablesByPrinter[c.printer_id] ??= []).push(c)
  const visible = filterPrinters(p.printers, filter, { agentsById, consumablesByPrinter, alerts: p.alerts })

  async function addComputer() {
    const { code, error } = await p.createPairingCode()
    if (error || !code) toast.error(t('printers.pair_error'))
    else setPairing(code)
  }

  async function download() {
    const { url, error } = await p.getAgentDownloadUrl()
    if (error || !url) toast.error(t('printers.pair_download_error'))
    else window.location.assign(url)
  }

  async function save(id, patch) {
    const { error } = await p.updatePrinter(id, patch)
    if (error) { toast.error(t('printers.action_failed')); return false }
    toast.success(t('printers.saved'))
    return true
  }

  async function confirmRemove() {
    const { kind, id } = confirm
    setConfirm(null)
    const { error } = kind === 'printer' ? await p.removePrinter(id) : await p.revokeAgent(id)
    if (error) toast.error(t('printers.action_failed'))
    else toast.success(t(kind === 'printer' ? 'printers.removed' : 'printers.computer_removed'))
  }

  async function ack(id) {
    const { error } = await p.acknowledgeAlert(id)
    if (error) toast.error(t('printers.action_failed'))
  }

  const openAlerts = p.alerts.filter((a) => a.status === 'open')
  const activeAgents = p.agents.filter((a) => a.status !== 'revoked')

  return (
    <div className="min-h-screen bg-bg pb-24">
      <AppNav />
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-xl font-bold text-ink">{t('printers.title')}</h1>
          <p className="text-base text-muted mt-0.5">{t('printers.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-7">
        {p.loading && <p className="text-base text-muted">{t('printers.loading')}</p>}
        {p.error && <p role="alert" className="text-base text-red">{t('printers.load_error')}</p>}

        {openAlerts.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-bold text-ink mb-3">{t('printers.alerts_title')}</h2>
            <ul className="space-y-3">
              {openAlerts.map((a) => (
                <li key={a.id} className="bg-surface border border-amber/40 rounded-xl p-4 flex items-start gap-3">
                  <AlertTriangle size={24} className="text-amber shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-base text-ink flex-1 break-words">{a.message}</p>
                  <Button variant="ghost" size="sm" onClick={() => ack(a.id)}>{t('printers.alert_ok')}</Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="font-display text-lg font-bold text-ink">{t('printers.computers_title')}</h2>
            <Button variant="secondary" size="md" className="shrink-0 whitespace-nowrap" onClick={addComputer}>
              <Plus size={18} aria-hidden="true" />{t('printers.add_computer')}
            </Button>
          </div>
          {activeAgents.length === 0 ? (
            <Card><p className="text-base text-muted">{t('printers.computers_empty')}</p><p className="text-base text-muted mt-2">{t('printers.computer_why')}</p></Card>
          ) : (
            <ul className="space-y-3">
              {activeAgents.map((a) => {
                const heard = timeAgo(a.last_heartbeat_at)
                const alive = a.status === 'online' && a.last_heartbeat_at && Date.now() - new Date(a.last_heartbeat_at).getTime() <= STALE_AFTER_MS
                return (
                  <li key={a.id}>
                    <Card>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet/10">
                          <Monitor size={22} className="text-violet" aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-ink text-base break-words">{a.device_name}</p>
                          <p className="text-sm text-muted">{heard ? t('printers.last_heard', { when: heard }) : t('printers.never_heard')}</p>
                        </div>
                        <Badge
                          label={t(alive ? 'printers.computer_online' : 'printers.computer_offline')}
                          variant={alive ? 'green' : 'amber'} className="shrink-0 whitespace-nowrap"
                        />
                      </div>
                      <div className="flex justify-end mt-3 pt-3 border-t border-border">
                        <button type="button" className={REMOVE_CLS} onClick={() => setConfirm({ kind: 'agent', id: a.id })}>
                          {t('printers.remove_computer')}
                        </button>
                      </div>
                    </Card>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2 mb-3">
            <Printer size={20} aria-hidden="true" />{t('printers.printers_title')}
          </h2>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide" role="group" aria-label={t('printers.filter_label')}>
            {FILTERS.map((f) => (
              <button
                key={f} type="button" onClick={() => setFilter(f)} aria-pressed={filter === f}
                className={[
                  'flex-shrink-0 min-h-[48px] px-4 rounded-pill text-base font-semibold transition-colors',
                  filter === f ? 'bg-violet text-white' : 'bg-surface text-muted hover:bg-border',
                ].join(' ')}
              >
                {t(`printers.filter_${FILTER_LABEL[f] ?? f}`)}
              </button>
            ))}
          </div>
          {p.printers.length === 0 ? (
            <Card><p className="text-base text-muted">{t('printers.printers_empty')}</p></Card>
          ) : visible.length === 0 ? (
            <Card><p className="text-base text-muted">{t('printers.filter_none')}</p></Card>
          ) : (
            <div className="space-y-4">
              {visible.map((pr) => (
                <PrinterCard
                  key={pr.id} printer={pr} agent={agentsById[pr.agent_id]} t={t}
                  supplies={consumablesByPrinter[pr.id] ?? []}
                  onSave={save} onRemove={(x) => setConfirm({ kind: 'printer', id: x.id })}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Modal open={!!pairing} onClose={() => setPairing(null)} title={t('printers.pair_title')}>
        <div className="space-y-3 text-base text-ink">
          <p>{t('printers.pair_step1')}</p>
          <Button variant="primary" size="md" className="w-full" onClick={download}>
            <Download size={20} aria-hidden="true" /> {t('printers.pair_download')}
          </Button>
          <p>{t('printers.pair_step2')}</p>
          <p className="font-display text-3xl font-bold tracking-widest text-center bg-bg rounded-xl py-4 select-all">
            {formatPairingCode(pairing)}
          </p>
          <p className="text-muted">{t('printers.pair_expires')}</p>
          <Button variant="secondary" size="md" className="w-full" onClick={() => setPairing(null)}>{t('printers.pair_done')}</Button>
        </div>
      </Modal>

      <Modal
        open={!!confirm} onClose={() => setConfirm(null)}
        title={confirm?.kind === 'printer' ? t('printers.remove') : t('printers.remove_computer')}
      >
        <div className="space-y-4 text-base text-ink">
          <p>{confirm?.kind === 'printer' ? t('printers.remove_confirm') : t('printers.remove_computer_confirm')}</p>
          <div className="flex gap-3">
            <Button variant="danger" size="md" onClick={confirmRemove}>{t('printers.remove')}</Button>
            <Button variant="muted" size="md" onClick={() => setConfirm(null)}>{t('printers.cancel')}</Button>
          </div>
        </div>
      </Modal>

      <DashboardNav />
    </div>
  )
}
