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

export default function DashboardSettings() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { owner, loading: ownerLoading, updateOwner } = useOwner()
  const navigate = useNavigate()
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [showDeactivate, setShowDeactivate] = useState(false)
  const [pwForm, setPwForm] = useState({ newPw: '', confirm: '' })
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    if (!owner) return
    setForm({
      name: owner.name || '',
      phone: owner.phone || '',
      shop_name: owner.shop_name || '',
      bw_rate: (owner.bw_rate / 100).toString(),
      color_rate: (owner.color_rate / 100).toString(),
      delivery_fee: (owner.delivery_fee / 100).toString(),
      upi_id: owner.upi_id || '',
      accept_cash: owner.accept_cash ?? true
    })
  }, [owner])

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    setSaving(true)
    const updates = {
      name: form.name,
      phone: form.phone,
      shop_name: form.shop_name,
      bw_rate: Math.round(parseFloat(form.bw_rate) * 100) || owner.bw_rate,
      color_rate: Math.round(parseFloat(form.color_rate) * 100) || owner.color_rate,
      delivery_fee: Math.round(parseFloat(form.delivery_fee || '0') * 100),
      upi_id: form.upi_id.trim() || null,
      accept_cash: form.accept_cash
    }
    const { error } = await updateOwner(updates)
    setSaving(false)
    if (error) toast.error(t('errors.network'))
    else toast.success(t('settings.saved'))
  }

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

  // Show loading while owner is fetching OR while form hasn't been populated yet.
  // Only show the error state once loading is definitively done and no owner was found.
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
        {/* Shop info */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.shop_info')}</h2>
          <Input label={t('settings.shop_name')} value={form.shop_name} onChange={e => set('shop_name', e.target.value)} />
          <div className="text-sm text-muted">
            <span className="font-medium">{t('settings.society')}:</span> {owner?.societies?.name}
          </div>
        </section>

        {/* Rates */}
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
          <Input
            label="Delivery fee (₹, 0 for free)"
            type="number"
            value={form.delivery_fee}
            onChange={e => set('delivery_fee', e.target.value)}
            min="0" step="1"
          />
        </section>

        {/* Payment */}
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

        {/* Account */}
        <section className="bg-surface rounded-xl shadow-card p-5 space-y-4">
          <h2 className="font-bold text-lg text-ink">{t('settings.account')}</h2>
          <Input label={t('settings.name_label')} value={form.name} onChange={e => set('name', e.target.value)} />
          <Input label={t('settings.phone_label')} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </section>

        <Button onClick={handleSave} loading={saving} className="w-full" size="md">
          {t('common.save')}
        </Button>

        {/* Security — change password */}
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

        {/* Danger zone — hidden while awaiting admin approval */}
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

      {/* Deactivate confirmation modal */}
      <Modal
        open={showDeactivate}
        onClose={() => setShowDeactivate(false)}
        title="Deactivate shop?"
      >
        <p className="text-muted mb-5">{t('settings.deactivate_confirm')}</p>
        <div className="flex gap-3">
          <Button variant="muted" onClick={() => setShowDeactivate(false)} className="flex-1">
            {t('common.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDeactivate} className="flex-1">
            Yes, deactivate
          </Button>
        </div>
      </Modal>

      <DashboardNav />
    </div>
  )
}
