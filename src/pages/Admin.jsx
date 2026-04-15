import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/countries'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Badge from '../components/ui/Badge'

export default function Admin() {
  const { t } = useTranslation()
  const [shops, setShops] = useState([])
  const [societies, setSocieties] = useState([])
  const [stats, setStats] = useState({ jobs_today: 0, gmv_month: 0 })
  const [defaults, setDefaults] = useState({ bw: '2', color: '5', delivery: '8' })
  const [loading, setLoading] = useState(true)
  const [savingDefaults, setSavingDefaults] = useState(false)

  useEffect(() => {
    async function loadData() {
      const [shopsRes, societiesRes, jobsRes] = await Promise.all([
        supabase.from('owners').select(`*, societies(name, city, state)`).order('created_at', { ascending: false }),
        supabase.from('societies').select('*').order('name'),
        supabase.from('jobs').select('id, total_amount, status, created_at')
      ])

      setShops(shopsRes.data || [])
      setSocieties(societiesRes.data || [])

      const jobs = jobsRes.data || []
      const today = new Date().toDateString()
      const monthStart = new Date(); monthStart.setDate(1)

      setStats({
        jobs_today: jobs.filter(j => new Date(j.created_at).toDateString() === today).length,
        gmv_month: jobs
          .filter(j => j.status === 'delivered' && new Date(j.created_at) >= monthStart)
          .reduce((s, j) => s + j.total_amount, 0)
      })

      // Load platform config
      const { data: config } = await supabase.from('platform_config').select('key, value')
      if (config) {
        const bw = config.find(c => c.key === 'default_bw_rate')
        const col = config.find(c => c.key === 'default_color_rate')
        const del = config.find(c => c.key === 'default_delivery_fee')
        setDefaults({
          bw: bw ? (parseInt(bw.value) / 100).toString() : '2',
          color: col ? (parseInt(col.value) / 100).toString() : '5',
          delivery: del ? (parseInt(del.value) / 100).toString() : '8'
        })
      }

      setLoading(false)
    }
    loadData()
  }, [])

  async function saveDefaults() {
    setSavingDefaults(true)
    const entries = [
      { key: 'default_bw_rate', value: String(Math.round(parseFloat(defaults.bw) * 100)) },
      { key: 'default_color_rate', value: String(Math.round(parseFloat(defaults.color) * 100)) },
      { key: 'default_delivery_fee', value: String(Math.round(parseFloat(defaults.delivery) * 100)) }
    ]
    for (const entry of entries) {
      await supabase.from('platform_config').upsert(entry)
    }
    setSavingDefaults(false)
    toast.success('Platform defaults saved!')
  }

  async function updateShopStatus(shopId, status) {
    await supabase.from('owners').update({ status }).eq('id', shopId)
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, status } : s))
    toast.success(`Shop ${status === 'active' ? 'reactivated' : 'deactivated'}`)
  }

  const fmt = v => formatCurrency(v, 'IN')

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-4xl mx-auto">
          <p className="text-white/60 text-sm font-medium mb-1">Platform Admin</p>
          <h1 className="font-display text-3xl font-bold">{t('admin.title')}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Overview stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t('admin.societies'), value: societies.length },
            { label: t('admin.shops'), value: shops.filter(s => s.status === 'active').length },
            { label: t('admin.jobs_today'), value: stats.jobs_today },
            { label: t('admin.gmv'), value: fmt(stats.gmv_month) }
          ].map(s => (
            <div key={s.label} className="bg-surface rounded-xl shadow-card p-4 text-center">
              <p className="font-display text-3xl font-black text-ink">{s.value}</p>
              <p className="text-sm text-muted mt-1">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Platform defaults */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
          <h2 className="font-bold text-xl text-ink">{t('admin.defaults')}</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Input label={t('admin.bw_default') + ' (₹/page)'} type="number" value={defaults.bw} onChange={e => setDefaults(d => ({ ...d, bw: e.target.value }))} min="0" step="0.5" />
            <Input label={t('admin.color_default') + ' (₹/page)'} type="number" value={defaults.color} onChange={e => setDefaults(d => ({ ...d, color: e.target.value }))} min="0" step="0.5" />
            <Input label={t('admin.delivery_default') + ' (₹)'} type="number" value={defaults.delivery} onChange={e => setDefaults(d => ({ ...d, delivery: e.target.value }))} min="0" step="1" />
          </div>
          <Button onClick={saveDefaults} loading={savingDefaults}>{t('admin.save_defaults')}</Button>
        </div>

        {/* All shops */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
          <h2 className="font-bold text-xl text-ink">{t('admin.all_shops')}</h2>
          {loading ? (
            <p className="text-muted">{t('common.loading')}</p>
          ) : (
            <div className="space-y-3">
              {shops.map(shop => (
                <div key={shop.id} className="flex items-center justify-between gap-3 p-4 bg-bg rounded-xl">
                  <div>
                    <p className="font-semibold text-ink">{shop.shop_name || shop.name}</p>
                    <p className="text-sm text-muted">{shop.societies?.name} · {shop.societies?.city}</p>
                    <p className="text-xs text-muted">{shop.name} · {shop.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge status={shop.status} />
                    {shop.status === 'active' ? (
                      <Button variant="danger" size="sm" onClick={() => updateShopStatus(shop.id, 'inactive')}>
                        Deactivate
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => updateShopStatus(shop.id, 'active')}>
                        Reactivate
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Society registry */}
        <div className="bg-surface rounded-xl shadow-card p-6 space-y-4">
          <h2 className="font-bold text-xl text-ink">{t('admin.societies')}</h2>
          <div className="space-y-2">
            {societies.map(s => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-bg rounded-xl text-sm">
                <div>
                  <span className="font-medium text-ink">{s.name}</span>
                  <span className="text-muted ml-2">{s.city}{s.state ? `, ${s.state}` : ''} · {s.postal_code}</span>
                </div>
                <span className="font-mono text-xs text-muted">{s.slug}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
