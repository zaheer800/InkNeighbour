import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { Image as ImageIcon, X, Plus, Trash2 } from 'lucide-react'
import { useOwner } from '../../hooks/useOwner'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AppNav from '../../components/AppNav'
import DashboardNav from '../../components/DashboardNav'
import ShopLocationMap from '../../components/ShopLocationMap'

const SERVICE_LABELS = {
  scan:           'Scanning',
  photocopy:      'Photocopying',
  binding:        'Binding',
  lamination:     'Lamination',
  passport_photo: 'Passport Photos',
}

const SUGGESTED_SERVICES = [
  'Spiral Binding',
  'Hard Binding',
  'ID Card Printing',
  'Stapling',
  'Typing / DTP',
  'Resume Printing',
]

const SUGGESTED_EXPENSES = [
  'Electricity',
  'Rent',
  'Staff wages',
  'Maintenance',
  'Internet',
]

const MAX_BANNER_SIZE = 5 * 1024 * 1024 // 5MB
const BANNER_TYPES = {
  'image/png':  ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif':  ['.gif'],
}
const EXT_BY_TYPE = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
}

function makeCustomServiceCode() {
  return `custom_${crypto.randomUUID().slice(0, 8)}`
}

export default function ShopProfile() {
  const { t } = useTranslation()
  const { owner, loading: ownerLoading, updateOwner } = useOwner()

  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  const [bannerUploading, setBannerUploading] = useState(false)
  const bannerUrlRef = useRef(null)

  const [services, setServices] = useState([])
  const [savingServices, setSavingServices] = useState(false)
  const [addingCustom, setAddingCustom] = useState(false)
  const [customDraft, setCustomDraft] = useState({ name: '', display_price: '' })
  const [addingChip, setAddingChip] = useState(null)

  const [tiers, setTiers] = useState([])
  const [deletedTierIds, setDeletedTierIds] = useState([])
  const [savingDelivery, setSavingDelivery] = useState(false)

  const [expenses, setExpenses] = useState([])
  const [savingExpenses, setSavingExpenses] = useState(false)
  const [addingExpenseChip, setAddingExpenseChip] = useState(null)
  const [addingOwnExpense, setAddingOwnExpense] = useState(false)
  const [expenseDraft, setExpenseDraft] = useState({ name: '', monthly_amount: '' })

  const isShop = owner?.provider_type === 'shop'

  useEffect(() => {
    if (!owner) return

    setForm({
      shop_name:     owner.shop_name     || '',
      description:   owner.description   || '',
      shop_address:  owner.shop_address  || '',
      locality:      owner.locality      || '',
      landmark:      owner.landmark      || '',
      lat:           owner.lat           ?? null,
      lng:           owner.lng           ?? null,
      gst_number:    owner.gst_number    || '',
      bw_rate:       (owner.bw_rate   / 100).toString(),
      color_rate:    (owner.color_rate / 100).toString(),
      delivery_fee:  ((owner.delivery_fee ?? 0) / 100).toString(),
      bw_cartridge_price:     owner.bw_cartridge_price    != null ? (owner.bw_cartridge_price / 100).toString()    : '',
      bw_cartridge_yield:     owner.bw_cartridge_yield    != null ? owner.bw_cartridge_yield.toString()            : '',
      color_cartridge_price:  owner.color_cartridge_price != null ? (owner.color_cartridge_price / 100).toString() : '',
      color_cartridge_yield:  owner.color_cartridge_yield != null ? owner.color_cartridge_yield.toString()         : '',
      paper_price:            owner.paper_price           != null ? (owner.paper_price / 100).toString()          : '',
      paper_sheets_per_ream:  owner.paper_sheets_per_ream != null ? owner.paper_sheets_per_ream.toString()         : '',
    })
    bannerUrlRef.current = owner.banner_url || null

    supabase
      .from('owner_expenses')
      .select('id, owner_id, name, monthly_amount')
      .eq('owner_id', owner.id)
      .then(({ data }) => setExpenses((data || []).map(e => ({ ...e, monthly_amount: (e.monthly_amount / 100).toString() }))))

    if (owner.provider_type === 'shop') {
      supabase
        .from('service_menu')
        .select('id, owner_id, service_code, is_enabled, display_price, name, is_preset')
        .eq('owner_id', owner.id)
        .then(({ data }) => setServices(data || []))

      supabase
        .from('delivery_fee_tiers')
        .select('id, max_km, fee')
        .eq('owner_id', owner.id)
        .order('max_km')
        .then(({ data }) => setTiers((data || []).map(t => ({ ...t, max_km: t.max_km.toString(), fee: (t.fee / 100).toString() }))))
    }
  }, [owner])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // ── Banner ────────────────────────────────────────────────────────────────
  async function uploadBanner(file) {
    if (!BANNER_TYPES[file.type]) { toast.error(t('shop_profile.banner_error_type')); return }
    if (file.size > MAX_BANNER_SIZE) { toast.error(t('shop_profile.banner_error_size')); return }

    setBannerUploading(true)
    try {
      const { data: existing } = await supabase.storage.from('logos').list(owner.id)
      if (existing?.length) {
        await supabase.storage.from('logos').remove(existing.map(f => `${owner.id}/${f.name}`))
      }

      const ext = EXT_BY_TYPE[file.type]
      const path = `${owner.id}/banner.${ext}`
      const { error: uploadErr } = await supabase.storage.from('logos').upload(path, file, { upsert: true })
      if (uploadErr) throw uploadErr

      const { data: pub } = supabase.storage.from('logos').getPublicUrl(path)
      const bannerUrl = `${pub.publicUrl}?v=${Date.now()}`

      const { error } = await updateOwner({ banner_url: bannerUrl })
      if (error) throw error
      bannerUrlRef.current = bannerUrl
      toast.success(t('settings.saved'))
    } catch {
      toast.error(t('errors.network'))
    } finally {
      setBannerUploading(false)
    }
  }

  async function removeBanner() {
    setBannerUploading(true)
    try {
      const { data: existing } = await supabase.storage.from('logos').list(owner.id)
      if (existing?.length) {
        await supabase.storage.from('logos').remove(existing.map(f => `${owner.id}/${f.name}`))
      }
      const { error } = await updateOwner({ banner_url: null })
      if (error) throw error
      bannerUrlRef.current = null
      toast.success(t('settings.saved'))
    } catch {
      toast.error(t('errors.network'))
    } finally {
      setBannerUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (accepted, rejected) => {
      if (rejected.length > 0) { toast.error(t('shop_profile.banner_error_type')); return }
      if (accepted[0]) uploadBanner(accepted[0])
    },
    accept: BANNER_TYPES,
    maxSize: MAX_BANNER_SIZE,
    multiple: false,
  })

  // ── Save shop info / rates ───────────────────────────────────────────────
  function toPaiseOrNull(v) {
    const n = parseFloat(v)
    return (v !== '' && !isNaN(n) && n >= 0) ? Math.round(n * 100) : null
  }

  function toPositiveIntOrNull(v) {
    const n = parseInt(v, 10)
    return (v !== '' && !isNaN(n) && n > 0) ? n : null
  }

  async function handleSaveShopInfo() {
    setSaving(true)
    const updates = {
      shop_name:    form.shop_name,
      description:  form.description.trim().slice(0, 200) || null,
      bw_rate:      Math.round(parseFloat(form.bw_rate)    * 100) || owner.bw_rate,
      color_rate:   Math.round(parseFloat(form.color_rate) * 100) || owner.color_rate,
      bw_cartridge_price:    toPaiseOrNull(form.bw_cartridge_price),
      bw_cartridge_yield:    toPositiveIntOrNull(form.bw_cartridge_yield),
      color_cartridge_price: toPaiseOrNull(form.color_cartridge_price),
      color_cartridge_yield: toPositiveIntOrNull(form.color_cartridge_yield),
      paper_price:           toPaiseOrNull(form.paper_price),
      paper_sheets_per_ream: toPositiveIntOrNull(form.paper_sheets_per_ream),
    }

    if (isShop) {
      updates.shop_address = form.shop_address.trim() || null
      updates.locality     = form.locality.trim() || null
      updates.landmark     = form.landmark.trim() || null
      updates.gst_number   = form.gst_number.trim() || null
      if (form.lat != null && form.lng != null) {
        updates.lat = form.lat
        updates.lng = form.lng
      }
    } else {
      updates.delivery_fee = Math.round(parseFloat(form.delivery_fee || '0') * 100)
    }

    const { error } = await updateOwner(updates)
    setSaving(false)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('settings.saved'))
  }

  // ── Services ──────────────────────────────────────────────────────────────
  function setSvc(id, field, value) {
    setServices(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  async function handleSaveServices() {
    setSavingServices(true)
    const updates = services.map(svc => ({
      id:            svc.id,
      owner_id:      svc.owner_id,
      service_code:  svc.service_code,
      is_enabled:    svc.is_enabled,
      display_price: svc.display_price?.trim() || null,
      name:          svc.name,
      is_preset:     svc.is_preset,
    }))

    const { error } = await supabase.from('service_menu').upsert(updates, { onConflict: 'id' })
    setSavingServices(false)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('settings.saved'))
  }

  async function addService(name, displayPrice = '') {
    const trimmedName = name.trim()
    if (!trimmedName) return null

    const row = {
      owner_id:      owner.id,
      service_code:  makeCustomServiceCode(),
      name:          trimmedName,
      is_preset:     false,
      is_enabled:    true,
      display_price: displayPrice.trim() || null,
    }

    const { data, error } = await supabase.from('service_menu').insert(row).select().single()
    if (error) { toast.error(t('errors.network')); return null }
    setServices(prev => [...prev, data])
    toast.success(t('settings.saved'))
    return data
  }

  async function handleAddCustomService() {
    const added = await addService(customDraft.name, customDraft.display_price)
    if (added) {
      setCustomDraft({ name: '', display_price: '' })
      setAddingCustom(false)
    }
  }

  async function handleAddSuggestedService(name) {
    setAddingChip(name)
    await addService(name)
    setAddingChip(null)
  }

  async function handleRemoveCustomService(id) {
    const { error } = await supabase.from('service_menu').delete().eq('id', id)
    if (error) { toast.error(t('errors.network')); return }
    setServices(prev => prev.filter(s => s.id !== id))
  }

  // ── Delivery tiers (shop) ────────────────────────────────────────────────
  function setTier(i, field, value) {
    setTiers(prev => prev.map((t, idx) => idx === i ? { ...t, [field]: value } : t))
  }

  function addTier() {
    setTiers(prev => [...prev, { id: null, max_km: '', fee: '' }])
  }

  function removeTier(i) {
    setTiers(prev => {
      const tier = prev[i]
      if (tier.id) setDeletedTierIds(ids => [...ids, tier.id])
      return prev.filter((_, idx) => idx !== i)
    })
  }

  async function handleSaveDelivery() {
    const parsed = tiers.map(t => ({
      id: t.id,
      max_km: parseFloat(t.max_km),
      fee: Math.round(parseFloat(t.fee || '0') * 100),
    }))
    if (parsed.some(t => isNaN(t.max_km) || t.max_km <= 0 || isNaN(t.fee) || t.fee < 0)) {
      toast.error(t('errors.network'))
      return
    }

    setSavingDelivery(true)
    try {
      if (deletedTierIds.length > 0) {
        await supabase.from('delivery_fee_tiers').delete().in('id', deletedTierIds)
      }
      for (const tier of parsed.filter(t => t.id)) {
        await supabase.from('delivery_fee_tiers').update({ max_km: tier.max_km, fee: tier.fee }).eq('id', tier.id)
      }
      const newTiers = parsed.filter(t => !t.id).map(t => ({ owner_id: owner.id, max_km: t.max_km, fee: t.fee }))
      if (newTiers.length > 0) {
        await supabase.from('delivery_fee_tiers').insert(newTiers)
      }

      const { data } = await supabase
        .from('delivery_fee_tiers')
        .select('id, max_km, fee')
        .eq('owner_id', owner.id)
        .order('max_km')
      setTiers((data || []).map(t => ({ ...t, max_km: t.max_km.toString(), fee: (t.fee / 100).toString() })))
      setDeletedTierIds([])
      toast.success(t('settings.saved'))
    } catch {
      toast.error(t('errors.network'))
    } finally {
      setSavingDelivery(false)
    }
  }

  // ── Other recurring expenses (rent, electricity, staff, ...) ────────────
  function setExpenseField(id, field, value) {
    setExpenses(prev => prev.map(e => e.id === id ? { ...e, [field]: value } : e))
  }

  async function addExpense(name) {
    const trimmedName = name.trim()
    if (!trimmedName) return null

    const row = { owner_id: owner.id, name: trimmedName, monthly_amount: 0 }
    const { data, error } = await supabase.from('owner_expenses').insert(row).select().single()
    if (error) { toast.error(t('errors.network')); return null }
    setExpenses(prev => [...prev, { ...data, monthly_amount: '' }])
    toast.success(t('settings.saved'))
    return data
  }

  async function handleAddExpenseChip(name) {
    setAddingExpenseChip(name)
    await addExpense(name)
    setAddingExpenseChip(null)
  }

  async function handleAddOwnExpense() {
    const added = await addExpense(expenseDraft.name)
    if (!added) return

    if (expenseDraft.monthly_amount) {
      const paise = toPaiseOrNull(expenseDraft.monthly_amount) || 0
      await supabase.from('owner_expenses').update({ monthly_amount: paise }).eq('id', added.id)
      setExpenses(prev => prev.map(e => e.id === added.id ? { ...e, monthly_amount: expenseDraft.monthly_amount } : e))
    }
    setExpenseDraft({ name: '', monthly_amount: '' })
    setAddingOwnExpense(false)
  }

  async function handleRemoveExpense(id) {
    const { error } = await supabase.from('owner_expenses').delete().eq('id', id)
    if (error) { toast.error(t('errors.network')); return }
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  async function handleSaveExpenses() {
    setSavingExpenses(true)
    const updates = expenses.map(e => ({
      id:             e.id,
      owner_id:       e.owner_id,
      name:           e.name,
      monthly_amount: toPaiseOrNull(e.monthly_amount) || 0,
    }))
    const { error } = await supabase.from('owner_expenses').upsert(updates, { onConflict: 'id' })
    setSavingExpenses(false)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('settings.saved'))
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

  const presetServices = services.filter(s => s.is_preset)
  const customServices = services.filter(s => !s.is_preset)
  const customServiceNames = new Set(customServices.map(s => s.name?.toLowerCase()))
  const suggestedServices = SUGGESTED_SERVICES.filter(name => !customServiceNames.has(name.toLowerCase()))

  return (
    <div className="min-h-screen bg-bg pb-24">
      <AppNav />
      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-xl font-bold text-ink">{t('shop_profile.title')}</h1>
          <p className="text-sm text-muted mt-0.5">{t('shop_profile.subtitle')}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* ── Banner ─────────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('shop_profile.banner_title')}</h2>
          <p className="text-sm text-muted">{t('shop_profile.banner_hint')}</p>

          {bannerUrlRef.current ? (
            <div className="space-y-3">
              <img
                src={bannerUrlRef.current}
                alt=""
                className="w-full h-40 object-cover rounded-xl border border-border"
              />
              <div className="flex gap-2">
                <div {...getRootProps()} className="flex-1">
                  <input {...getInputProps()} />
                  <Button variant="secondary" size="sm" loading={bannerUploading} className="w-full" type="button">
                    {t('shop_profile.replace_banner')}
                  </Button>
                </div>
                <Button variant="danger" size="sm" onClick={removeBanner} loading={bannerUploading} type="button">
                  <X size={16} />
                  {t('shop_profile.remove_banner')}
                </Button>
              </div>
            </div>
          ) : (
            <div
              {...getRootProps()}
              className={[
                'border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-2 text-center cursor-pointer transition-colors min-h-[140px] justify-center',
                isDragActive ? 'border-violet bg-violet/5' : 'border-border hover:border-violet/40',
              ].join(' ')}
            >
              <input {...getInputProps()} />
              <ImageIcon size={28} className="text-muted" />
              <p className="text-sm font-semibold text-ink">
                {bannerUploading ? t('shop_profile.banner_uploading') : t('shop_profile.upload_banner')}
              </p>
            </div>
          )}
        </section>

        {/* ── Shop info ──────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.shop_info')}</h2>
          <Input label={t('settings.shop_name')} value={form.shop_name} onChange={e => set('shop_name', e.target.value)} />

          <Input
            label={t('shop_profile.description_label')}
            value={form.description}
            onChange={e => set('description', e.target.value.slice(0, 200))}
            placeholder={t('shop_profile.description_placeholder')}
            hint={t('shop_profile.description_hint')}
          />

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
              address={form.shop_address}
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
        </section>

        {/* ── Cartridge cost ────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <div>
            <h2 className="font-bold text-lg text-ink">{t('shop_profile.cartridge_title')}</h2>
            <p className="text-sm text-muted mt-1">{t('shop_profile.cartridge_hint')}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.cartridge_bw_label')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('shop_profile.cartridge_price_label')}
                type="number"
                value={form.bw_cartridge_price}
                onChange={e => set('bw_cartridge_price', e.target.value)}
                placeholder="e.g. 650"
                min="0" step="1"
              />
              <Input
                label={t('shop_profile.cartridge_yield_label')}
                type="number"
                value={form.bw_cartridge_yield}
                onChange={e => set('bw_cartridge_yield', e.target.value)}
                placeholder="e.g. 1500"
                min="1" step="1"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.cartridge_color_label')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('shop_profile.cartridge_price_label')}
                type="number"
                value={form.color_cartridge_price}
                onChange={e => set('color_cartridge_price', e.target.value)}
                placeholder="e.g. 1500"
                min="0" step="1"
              />
              <Input
                label={t('shop_profile.cartridge_yield_label')}
                type="number"
                value={form.color_cartridge_yield}
                onChange={e => set('color_cartridge_yield', e.target.value)}
                placeholder="e.g. 400"
                min="1" step="1"
              />
            </div>
          </div>

          <div>
            <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.paper_label')}</p>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={t('shop_profile.paper_price_label')}
                type="number"
                value={form.paper_price}
                onChange={e => set('paper_price', e.target.value)}
                placeholder="e.g. 300"
                min="0" step="1"
              />
              <Input
                label={t('shop_profile.paper_sheets_label')}
                type="number"
                value={form.paper_sheets_per_ream}
                onChange={e => set('paper_sheets_per_ream', e.target.value)}
                placeholder="e.g. 500"
                min="1" step="1"
              />
            </div>
          </div>
        </section>

        <Button onClick={handleSaveShopInfo} loading={saving} className="w-full" size="md">
          {t('shop_profile.save_shop_info')}
        </Button>

        {/* ── Other recurring expenses ─────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <div>
            <h2 className="font-bold text-lg text-ink">{t('shop_profile.expenses_title')}</h2>
            <p className="text-sm text-muted mt-1">{t('shop_profile.expenses_hint')}</p>
          </div>

          {expenses.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.expenses_custom_title')}</p>
              <div className="space-y-3">
                {expenses.map(exp => (
                  <div key={exp.id} className="p-3 rounded-xl bg-bg space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="flex-1 min-h-[44px] flex items-center text-base font-medium text-ink">{exp.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(exp.id)}
                        className="text-muted hover:text-red transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center flex-shrink-0"
                        aria-label="Remove expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <Input
                      label={t('shop_profile.expense_amount_label')}
                      type="number"
                      value={exp.monthly_amount}
                      onChange={e => setExpenseField(exp.id, 'monthly_amount', e.target.value)}
                      placeholder="e.g. 2000"
                      min="0" step="1"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {expenses.length > 0 && (
            <Button onClick={handleSaveExpenses} loading={savingExpenses} variant="secondary" size="sm" className="w-full">
              {t('shop_profile.save_expenses')}
            </Button>
          )}

          {(() => {
            const existingExpenseNames = new Set(expenses.map(e => e.name?.toLowerCase()))
            const suggestedExpenses = SUGGESTED_EXPENSES.filter(name => !existingExpenseNames.has(name.toLowerCase()))
            return suggestedExpenses.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.expenses_suggested_title')}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedExpenses.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleAddExpenseChip(name)}
                      disabled={addingExpenseChip === name}
                      className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border border-violet/30 bg-violet/5 text-sm font-semibold text-violet hover:bg-violet/10 transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )
          })()}

          {addingOwnExpense ? (
            <div className="p-3 rounded-xl bg-bg space-y-2">
              <input
                type="text"
                value={expenseDraft.name}
                onChange={e => setExpenseDraft(d => ({ ...d, name: e.target.value.slice(0, 60) }))}
                placeholder={t('shop_profile.expense_name_placeholder')}
                maxLength={60}
                className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40"
              />
              <input
                type="number"
                value={expenseDraft.monthly_amount}
                onChange={e => setExpenseDraft(d => ({ ...d, monthly_amount: e.target.value }))}
                placeholder="e.g. 2000"
                min="0" step="1"
                className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddOwnExpense} className="flex-1">
                  {t('shop_profile.add_expense_submit')}
                </Button>
                <Button size="sm" variant="muted" onClick={() => { setAddingOwnExpense(false); setExpenseDraft({ name: '', monthly_amount: '' }) }}>
                  {t('shop_profile.cancel_add')}
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingOwnExpense(true)}
              className="flex items-center gap-1.5 text-sm font-semibold text-violet hover:text-violet/80 transition-colors min-h-[44px]"
            >
              <Plus size={16} />
              {t('shop_profile.add_own_expense')}
            </button>
          )}
        </section>

        {/* ── Delivery ──────────────────────────────────────────────────── */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('shop_profile.delivery_title')}</h2>

          {!isShop && (
            <Input
              label={t('shop_profile.delivery_fee_home_label')}
              type="number"
              value={form.delivery_fee}
              onChange={e => set('delivery_fee', e.target.value)}
              min="0" step="1"
            />
          )}

          {isShop && (
            <>
              <p className="text-sm text-muted">{t('shop_profile.delivery_hint_shop')}</p>
              <div className="space-y-3">
                {tiers.map((tier, i) => (
                  <div key={tier.id ?? `new-${i}`} className="flex items-center gap-1.5">
                    <span className="text-xs text-muted shrink-0">Up to</span>
                    <input
                      type="number" inputMode="decimal"
                      value={tier.max_km}
                      onChange={e => setTier(i, 'max_km', e.target.value)}
                      placeholder="km"
                      min="0.1" step="0.5"
                      className="w-16 min-h-[44px] px-2 rounded-xl border border-border text-sm text-center text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40"
                    />
                    <span className="text-xs text-muted shrink-0">km · ₹</span>
                    <input
                      type="number" inputMode="decimal"
                      value={tier.fee}
                      onChange={e => setTier(i, 'fee', e.target.value)}
                      placeholder="fee"
                      min="0" step="1"
                      className="w-16 min-h-[44px] px-2 rounded-xl border border-border text-sm text-center text-ink bg-surface focus:outline-none focus:ring-2 focus:ring-violet/40"
                    />
                    <button
                      type="button"
                      onClick={() => removeTier(i)}
                      className="text-muted hover:text-red transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center"
                      aria-label={t('shop_profile.remove_tier')}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTier}
                className="flex items-center gap-1.5 text-sm font-semibold text-violet hover:text-violet/80 transition-colors min-h-[44px]"
              >
                <Plus size={16} />
                {t('shop_profile.add_tier')}
              </button>
              <Button onClick={handleSaveDelivery} loading={savingDelivery} variant="secondary" size="sm" className="w-full">
                {t('shop_profile.save_delivery')}
              </Button>
            </>
          )}

        </section>

        {/* ── Service menu (print shop only) ────────────────────────────── */}
        {isShop && (
          <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
            <div>
              <h2 className="font-bold text-lg text-ink">{t('settings.service_menu')}</h2>
              <p className="text-sm text-muted mt-1">{t('settings.service_menu_hint')}</p>
            </div>

            <div className="space-y-3">
              {presetServices.map(svc => (
                <div key={svc.id} className="p-3 rounded-xl bg-bg space-y-2">
                  <label className="flex items-center gap-2 min-h-[44px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={svc.is_enabled}
                      onChange={e => setSvc(svc.id, 'is_enabled', e.target.checked)}
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
                      onChange={e => setSvc(svc.id, 'display_price', e.target.value)}
                      placeholder="e.g. ₹5/page"
                      maxLength={40}
                      className="w-full ml-7 max-w-[calc(100%-1.75rem)] min-h-[44px] border border-border rounded-xl px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40 placeholder:text-muted"
                    />
                  )}
                </div>
              ))}
            </div>

            {customServices.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.services_custom_title')}</p>
                <div className="space-y-3">
                  {customServices.map(svc => (
                    <div key={svc.id} className="p-3 rounded-xl bg-bg space-y-2">
                      <div className="flex items-start gap-3">
                        <label className="flex items-center gap-2 flex-1 min-h-[44px] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={svc.is_enabled}
                            onChange={e => setSvc(svc.id, 'is_enabled', e.target.checked)}
                            className="w-5 h-5 rounded accent-violet flex-shrink-0"
                          />
                          <span className="text-base font-medium text-ink">{svc.name}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomService(svc.id)}
                          className="text-muted hover:text-red transition-colors min-h-[44px] min-w-[36px] flex items-center justify-center flex-shrink-0"
                          aria-label="Remove service"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <input
                        type="text"
                        value={svc.display_price || ''}
                        onChange={e => setSvc(svc.id, 'display_price', e.target.value)}
                        placeholder="e.g. ₹5/page"
                        maxLength={40}
                        className="w-full ml-7 max-w-[calc(100%-1.75rem)] min-h-[44px] border border-border rounded-xl px-3 py-2 text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40 placeholder:text-muted"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {suggestedServices.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-ink mb-2">{t('shop_profile.suggested_services_title')}</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedServices.map(name => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleAddSuggestedService(name)}
                      disabled={addingChip === name}
                      className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border border-violet/30 bg-violet/5 text-sm font-semibold text-violet hover:bg-violet/10 transition-colors disabled:opacity-50"
                    >
                      <Plus size={16} />
                      {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {addingCustom ? (
              <div className="p-3 rounded-xl bg-bg space-y-2">
                <input
                  type="text"
                  value={customDraft.name}
                  onChange={e => setCustomDraft(d => ({ ...d, name: e.target.value.slice(0, 60) }))}
                  placeholder={t('shop_profile.custom_name_placeholder')}
                  maxLength={60}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40"
                />
                <input
                  type="text"
                  value={customDraft.display_price}
                  onChange={e => setCustomDraft(d => ({ ...d, display_price: e.target.value.slice(0, 40) }))}
                  placeholder={t('shop_profile.custom_price_placeholder')}
                  maxLength={40}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-border text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-violet/40"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddCustomService} className="flex-1">
                    {t('shop_profile.add_service_submit')}
                  </Button>
                  <Button size="sm" variant="muted" onClick={() => { setAddingCustom(false); setCustomDraft({ name: '', display_price: '' }) }}>
                    {t('shop_profile.cancel_add')}
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingCustom(true)}
                className="flex items-center gap-1.5 text-sm font-semibold text-violet hover:text-violet/80 transition-colors min-h-[44px]"
              >
                <Plus size={16} />
                {t('shop_profile.add_own_service')}
              </button>
            )}

            <Button onClick={handleSaveServices} loading={savingServices} variant="secondary" size="sm" className="w-full">
              {t('settings.save_services')}
            </Button>
          </section>
        )}
      </div>

      <DashboardNav />
    </div>
  )
}
