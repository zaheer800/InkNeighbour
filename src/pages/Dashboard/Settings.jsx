import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { useOwner } from '../../hooks/useOwner'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import AppNav from '../../components/AppNav'
import DashboardNav from '../../components/DashboardNav'
import ShopLocationMap from '../../components/ShopLocationMap'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const SERVICE_LABELS = {
  scan:           'Scanning',
  photocopy:      'Photocopying',
  binding:        'Binding',
  lamination:     'Lamination',
  passport_photo: 'Passport Photos',
}

export default function DashboardSettings() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { owner, loading: ownerLoading, updateOwner } = useOwner()
  const navigate = useNavigate()

  const [form, setForm]           = useState(null)
  const [saving, setSaving]       = useState(false)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [pwForm, setPwForm]       = useState({ newPw: '', confirm: '' })
  const [savingPw, setSavingPw]   = useState(false)

  // Print shop: service menu state
  const [services, setServices]     = useState([])
  const [savingServices, setSavingServices] = useState(false)

  // Print shop: operating hours state
  const [hours, setHours]           = useState(null)
  const [savingHours, setSavingHours] = useState(false)

  // Populate form when owner loads
  useEffect(() => {
    if (!owner) return

    const isShop = owner.provider_type === 'shop'

    setForm({
      name:            owner.name            || '',
      phone:           owner.phone           || '',
      shop_name:       owner.shop_name       || '',
      shop_address:    owner.shop_address    || '',
      locality:        owner.locality        || '',
      landmark:        owner.landmark        || '',
      lat:             owner.lat             ?? null,
      lng:             owner.lng             ?? null,
      bw_rate:         (owner.bw_rate  / 100).toString(),
      color_rate:      (owner.color_rate / 100).toString(),
      delivery_fee:    ((owner.delivery_fee ?? 0) / 100).toString(),
      upi_id:          owner.upi_id          || '',
      accept_cash:     owner.accept_cash     ?? true,
      max_active_jobs: (owner.max_active_jobs ?? (isShop ? 10 : 3)).toString(),
      gst_number:      owner.gst_number      || '',
    })

    if (isShop) {
      // Load service menu
      supabase
        .from('service_menu')
        .select('id, service_code, is_enabled, display_price')
        .eq('owner_id', owner.id)
        .then(({ data }) => {
          setServices(data || [])
        })

      // Load operating hours
      supabase
        .from('availability_schedules')
        .select('day_of_week, start_time, end_time')
        .eq('owner_id', owner.id)
        .then(({ data }) => {
          const base = Array.from({ length: 7 }, (_, i) => ({
            dow: i, enabled: false, start: '09:00', end: '18:00'
          }))
          if (data) {
            data.forEach(row => {
              base[row.day_of_week].enabled = true
              base[row.day_of_week].start   = (row.start_time || '09:00:00').slice(0, 5)
              base[row.day_of_week].end     = (row.end_time   || '18:00:00').slice(0, 5)
            })
          }
          setHours(base)
        })
    }
  }, [owner])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // ── Save core owner fields ───────────────────────────────────────────────
  async function handleSave() {
    setSaving(true)
    const isShop = owner.provider_type === 'shop'
    const updates = {
      name:            form.name,
      phone:           form.phone,
      shop_name:       form.shop_name,
      bw_rate:         Math.round(parseFloat(form.bw_rate)  * 100) || owner.bw_rate,
      color_rate:      Math.round(parseFloat(form.color_rate) * 100) || owner.color_rate,
      upi_id:          form.upi_id.trim() || null,
      accept_cash:     form.accept_cash,
      max_active_jobs: parseInt(form.max_active_jobs) || (isShop ? 10 : 3),
    }

    if (!isShop) {
      updates.delivery_fee = Math.round(parseFloat(form.delivery_fee || '0') * 100)
    } else {
      updates.shop_address = form.shop_address.trim() || null
      updates.locality     = form.locality.trim() || null
      updates.landmark     = form.landmark.trim() || null
      updates.gst_number   = form.gst_number.trim() || null
      if (form.lat != null && form.lng != null) {
        updates.lat = form.lat
        updates.lng = form.lng
      }
    }

    const { error } = await updateOwner(updates)
    setSaving(false)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('settings.saved'))
  }

  // ── Save service menu ────────────────────────────────────────────────────
  async function handleSaveServices() {
    setSavingServices(true)
    const updates = services.map(svc => ({
      id:            svc.id,
      is_enabled:    svc.is_enabled,
      display_price: svc.display_price?.trim() || null,
    }))

    const { error } = await supabase
      .from('service_menu')
      .upsert(updates, { onConflict: 'id' })

    setSavingServices(false)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('settings.saved'))
  }

  function setSvc(serviceCode, field, value) {
    setServices(prev => prev.map(s =>
      s.service_code === serviceCode ? { ...s, [field]: value } : s
    ))
  }

  // ── Save operating hours ─────────────────────────────────────────────────
  async function handleSaveHours() {
    if (!owner || !hours) return
    setSavingHours(true)

    // Delete existing schedules and re-insert enabled ones
    await supabase.from('availability_schedules').delete().eq('owner_id', owner.id)

    const rows = hours
      .filter(h => h.enabled)
      .map(h => ({
        owner_id:    owner.id,
        day_of_week: h.dow,
        start_time:  h.start + ':00',
        end_time:    h.end   + ':00',
      }))

    if (rows.length > 0) {
      const { error } = await supabase.from('availability_schedules').insert(rows)
      if (error) { toast.error(t('errors.network')); setSavingHours(false); return }
    }

    setSavingHours(false)
    toast.success(t('settings.saved'))
  }

  // ── Change password ──────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (pwForm.newPw.length < 6) { toast.error('Password must be at least 6 characters'); return }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setSavingPw(true)
    const { error } = await supabase.auth.updateUser({ password: pwForm.newPw })
    setSavingPw(false)
    if (error) toast.error(error.message || 'Could not update password')
    else { toast.success('Password updated'); setPwForm({ newPw: '', confirm: '' }) }
  }

  async function handleDeactivate() {
    await updateOwner({ status: 'inactive' })
    setShowDeactivate(false)
    toast.success('Your shop has been deactivated.')
    await signOut()
    navigate('/')
  }

  async function handleSignOut() {
    await signOut()
    navigate('/')
  }

  if (ownerLoading || !form) {
    if (!ownerLoading && !owner) return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">No shop found. Please contact support.</p>
      </div>
    )
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-muted">{t('common.loading')}</p>
      </div>
    )
  }

  const isShop = owner.provider_type === 'shop'

  return (
    <div className="min-h-screen bg-bg pb-24">
      <AppNav right={
        <button
          onClick={handleSignOut}
          className="text-white/60 hover:text-white text-sm font-medium transition-colors min-h-[44px] px-2"
        >
          Sign out
        </button>
      } />
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-xl font-bold text-ink">{t('settings.title')}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Shop info ──────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.shop_info')}</h2>
          <Input label={t('settings.shop_name')} value={form.shop_name} onChange={e => set('shop_name', e.target.value)} />

          {/* Home owner: show society; Print shop: show locality/address */}
          {!isShop && (
            <div className="text-sm text-muted">
              <span className="font-medium">{t('settings.society')}:</span> {owner?.societies?.name}
            </div>
          )}
          {isShop && (
            <>
              <Input
                label="Shop address"
                value={form.shop_address}
                onChange={e => set('shop_address', e.target.value)}
                placeholder="Street, area, city"
              />
              <Input
                label="Locality / area"
                value={form.locality}
                onChange={e => set('locality', e.target.value)}
                placeholder="e.g. Tarnaka, Malkajgiri"
              />
              <Input
                label="Landmark (optional)"
                value={form.landmark}
                onChange={e => set('landmark', e.target.value)}
                placeholder="e.g. Near Metro Station"
              />
              <Input
                label="GST number (optional)"
                value={form.gst_number}
                onChange={e => set('gst_number', e.target.value)}
                placeholder="e.g. 36ABCDE1234F1Z5"
              />
            </>
          )}
        </section>

        {/* ── Map pin (print shop only) ───────────────────────────────────── */}
        {isShop && (
          <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-lg text-ink">{t('settings.map_pin')}</h2>
              <p className="text-sm text-muted mt-1">{t('settings.map_pin_hint')}</p>
            </div>
            <ShopLocationMap
              lat={form.lat}
              lng={form.lng}
              onChange={({ lat, lng }) => { set('lat', lat); set('lng', lng) }}
            />
          </section>
        )}

        {/* ── Rates ─────────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.rates')}</h2>
          <Input
            label="B&W per page (₹)"
            type="number"
            value={form.bw_rate}
            onChange={e => set('bw_rate', e.target.value)}
            min="0" step="0.5"
          />
          <Input
            label="Colour per page (₹)"
            type="number"
            value={form.color_rate}
            onChange={e => set('color_rate', e.target.value)}
            min="0" step="0.5"
          />
          {!isShop && (
            <Input
              label="Delivery fee (₹, 0 for free)"
              type="number"
              value={form.delivery_fee}
              onChange={e => set('delivery_fee', e.target.value)}
              min="0" step="1"
            />
          )}
          <Input
            label="Max simultaneous jobs"
            type="number"
            value={form.max_active_jobs}
            onChange={e => set('max_active_jobs', e.target.value)}
            min="1" max="50" step="1"
            hint={isShop ? 'Recommended: 10–20 for a print shop.' : 'Recommended: 3–5 for a home printer.'}
          />
        </section>

        {/* ── Payment ───────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.payment')}</h2>
          <Input
            label="UPI ID"
            value={form.upi_id}
            onChange={e => set('upi_id', e.target.value)}
            placeholder="yourname@upi"
          />
          <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
            <input
              type="checkbox"
              checked={form.accept_cash}
              onChange={e => set('accept_cash', e.target.checked)}
              className="w-5 h-5 rounded accent-violet"
            />
            <span className="text-base font-medium text-ink">Accept cash on delivery</span>
          </label>
        </section>

        {/* ── Account ───────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.account')}</h2>
          <Input label={t('settings.name_label')}  value={form.name}  onChange={e => set('name',  e.target.value)} />
          <Input label={t('settings.phone_label')} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </section>

        <Button onClick={handleSave} loading={saving} className="w-full" size="md">
          {t('common.save')}
        </Button>

        {/* ── Service menu (print shop only) ────────────────────────────── */}
        {isShop && services.length > 0 && (
          <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-lg text-ink">{t('settings.service_menu')}</h2>
              <p className="text-sm text-muted mt-1">{t('settings.service_menu_hint')}</p>
            </div>

            <div className="space-y-3">
              {services.map(svc => (
                <div key={svc.service_code} className="flex items-start gap-3 p-3 rounded-xl bg-bg">
                  <label className="flex items-center gap-2 flex-1 min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={svc.is_enabled}
                      onChange={e => setSvc(svc.service_code, 'is_enabled', e.target.checked)}
                      className="w-5 h-5 rounded accent-violet flex-shrink-0"
                    />
                    <span className="text-base font-medium text-ink">
                      {SERVICE_LABELS[svc.service_code] || svc.service_code}
                    </span>
                  </label>
                  {svc.is_enabled && (
                    <input
                      type="text"
                      value={svc.display_price || ''}
                      onChange={e => setSvc(svc.service_code, 'display_price', e.target.value)}
                      placeholder="e.g. ₹5/page"
                      maxLength={40}
                      className="w-28 border border-border rounded-xl px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40 placeholder:text-muted"
                    />
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleSaveServices} loading={savingServices} variant="secondary" size="sm" className="w-full">
              {t('settings.save_services')}
            </Button>
          </section>
        )}

        {/* ── Operating hours (print shop only) ────────────────────────── */}
        {isShop && hours && (
          <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-lg text-ink">{t('settings.operating_hours')}</h2>
              <p className="text-sm text-muted mt-1">{t('settings.operating_hours_hint')}</p>
            </div>

            <div className="space-y-2">
              {hours.map((h, dow) => (
                <div key={dow} className="flex items-center gap-3 py-1">
                  <label className="flex items-center gap-2 w-16 cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={e => setHours(prev => prev.map((x, i) => i === dow ? { ...x, enabled: e.target.checked } : x))}
                      className="w-5 h-5 rounded accent-violet"
                    />
                    <span className="text-sm font-medium text-ink">{DAY_NAMES[dow]}</span>
                  </label>
                  {h.enabled ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={h.start}
                        onChange={e => setHours(prev => prev.map((x, i) => i === dow ? { ...x, start: e.target.value } : x))}
                        className="border border-border rounded-lg px-2 py-1.5 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[40px]"
                      />
                      <span className="text-muted text-sm">–</span>
                      <input
                        type="time"
                        value={h.end}
                        onChange={e => setHours(prev => prev.map((x, i) => i === dow ? { ...x, end: e.target.value } : x))}
                        className="border border-border rounded-lg px-2 py-1.5 text-sm text-ink bg-bg focus:outline-none focus:ring-2 focus:ring-violet/40 min-h-[40px]"
                      />
                    </div>
                  ) : (
                    <span className="text-sm text-muted italic">Closed</span>
                  )}
                </div>
              ))}
            </div>

            <Button onClick={handleSaveHours} loading={savingHours} variant="secondary" size="sm" className="w-full">
              {t('settings.save_hours')}
            </Button>
          </section>
        )}

        {/* ── Security ──────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">Security</h2>
          <Input
            label="New password"
            type="password"
            value={pwForm.newPw}
            onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
            placeholder="At least 6 characters"
            autoComplete="new-password"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={pwForm.confirm}
            onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            placeholder="Repeat new password"
            autoComplete="new-password"
          />
          <Button onClick={handleChangePassword} loading={savingPw} variant="secondary" size="sm">
            Update password
          </Button>
        </section>

        {/* ── Danger zone ───────────────────────────────────────────────── */}
        {owner?.status !== 'pending' && (
          <section className="bg-red/5 border border-red/20 rounded-xl p-5 space-y-3">
            <h2 className="font-bold text-lg text-red">{t('settings.danger_zone')}</h2>
            <p className="text-sm text-muted">Deactivating will make your shop unavailable to customers. You can reactivate later by contacting support.</p>
            <Button variant="danger" onClick={() => setShowDeactivate(true)} className="w-full">
              {t('settings.deactivate')}
            </Button>
          </section>
        )}
      </div>

      <Modal open={showDeactivate} onClose={() => setShowDeactivate(false)} title="Deactivate shop?">
        <p className="text-muted mb-5">{t('settings.deactivate_confirm')}</p>
        <div className="flex gap-3">
          <Button variant="muted" onClick={() => setShowDeactivate(false)} className="flex-1">{t('common.cancel')}</Button>
          <Button variant="danger" onClick={handleDeactivate} className="flex-1">Yes, deactivate</Button>
        </div>
      </Modal>

      <DashboardNav />
    </div>
  )
}
