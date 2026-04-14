import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Bell, RefreshCw, BarChart2, MessageSquare, Settings, LogOut, ToggleLeft, ToggleRight } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../hooks/useAuth'
import { useOwner } from '../../hooks/useOwner'
import { useJobs } from '../../hooks/useJobs'
import JobCard from '../../components/JobCard'
import Button from '../../components/ui/Button'
import { formatCurrency } from '../../lib/countries'
import { setupOwnerPush } from '../../notifications/index'

const TABS = ['submitted', 'accepted', 'printing', 'delivered', 'cancelled']
const TAB_LABELS = {
  submitted: 'Pending',
  accepted: 'Accepted',
  printing: 'Printing',
  delivered: 'Delivered',
  cancelled: 'Cancelled'
}

export default function DashboardJobs() {
  const { t } = useTranslation()
  const { signOut } = useAuth()
  const { owner, toggleStatus } = useOwner()
  const { jobs, loading, fetchJobs } = useJobs()
  const [activeTab, setActiveTab] = useState('submitted')
  const [toggling, setToggling] = useState(false)

  const countryCode = owner?.country_code || 'IN'
  const fmt = v => formatCurrency(v, countryCode)

  // Stats
  const today = new Date().toDateString()
  const jobsToday = jobs.filter(j => new Date(j.created_at).toDateString() === today).length
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)
  const monthStart = new Date(); monthStart.setDate(1)
  const earningsWeek = jobs
    .filter(j => j.status === 'delivered' && new Date(j.updated_at) >= weekStart)
    .reduce((s, j) => s + j.total_amount, 0)
  const earningsMonth = jobs
    .filter(j => j.status === 'delivered' && new Date(j.updated_at) >= monthStart)
    .reduce((s, j) => s + j.total_amount, 0)

  const filteredJobs = jobs.filter(j => j.status === activeTab)

  async function handleToggle() {
    setToggling(true)
    const { error } = await toggleStatus()
    if (error) toast.error(t('errors.network'))
    setToggling(false)
  }

  async function enablePush() {
    if (!owner) return
    const sub = await setupOwnerPush(owner.id)
    if (sub) toast.success('Push notifications enabled!')
    else toast.error('Could not enable notifications. Check browser permissions.')
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Top navbar */}
      <nav className="bg-ink2 text-white px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="font-display font-bold text-lg">
              {owner?.shop_name || 'My Shop'}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${owner?.status === 'active' ? 'bg-green' : 'bg-amber'}`} />
              <span className="text-sm text-white/70 capitalize">{owner?.status || 'loading'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={enablePush}
              className="p-2 text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Enable notifications"
            >
              <Bell size={20} />
            </button>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className="p-2 text-white/60 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Toggle shop status"
            >
              {owner?.status === 'active' ? <ToggleRight size={24} className="text-green" /> : <ToggleLeft size={24} className="text-amber" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Stats bar */}
      {owner && (
        <div className="bg-ink2/90 text-white px-4 pb-4">
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-3">
            {[
              { label: t('dashboard.jobs_today'), value: jobsToday },
              { label: t('dashboard.earnings_week'), value: fmt(earningsWeek) },
              { label: t('dashboard.earnings_month'), value: fmt(earningsMonth) }
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{s.value}</p>
                <p className="text-xs text-white/60 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                'flex-shrink-0 px-4 py-2 rounded-pill text-sm font-semibold transition-colors',
                activeTab === tab
                  ? 'bg-violet text-white'
                  : 'bg-surface text-muted hover:bg-border'
              ].join(' ')}
            >
              {TAB_LABELS[tab]}
              <span className={`ml-1.5 text-xs ${activeTab === tab ? 'text-white/70' : 'text-muted'}`}>
                ({jobs.filter(j => j.status === tab).length})
              </span>
            </button>
          ))}
        </div>

        {/* Refresh */}
        <div className="flex justify-end">
          <button
            onClick={fetchJobs}
            className="flex items-center gap-1.5 text-sm text-violet hover:text-violet/70 transition-colors min-h-[44px] px-2"
          >
            <RefreshCw size={14} /> {t('dashboard.refresh')}
          </button>
        </div>

        {/* Jobs list */}
        {loading ? (
          <p className="text-center text-muted py-12">{t('common.loading')}</p>
        ) : filteredJobs.length === 0 ? (
          <p className="text-center text-muted py-12">
            {activeTab === 'submitted' ? t('dashboard.empty_pending') :
             activeTab === 'printing' ? t('dashboard.empty_printing') :
             activeTab === 'delivered' ? t('dashboard.empty_delivered') :
             t('dashboard.empty_cancelled')}
          </p>
        ) : (
          <div className="space-y-4">
            {filteredJobs.map(job => (
              <JobCard key={job.id} job={job} onRefresh={fetchJobs} />
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-30">
        {[
          { to: '/dashboard', icon: null, label: 'Jobs', active: true },
          { to: '/dashboard/earnings', icon: BarChart2, label: 'Earnings' },
          { to: '/dashboard/feedback', icon: MessageSquare, label: 'Feedback' },
          { to: '/dashboard/settings', icon: Settings, label: 'Settings' }
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors min-h-[56px]',
              item.active ? 'text-violet' : 'text-muted hover:text-ink'
            ].join(' ')}
          >
            {item.icon && <item.icon size={20} />}
            {!item.icon && <span className="text-base">📋</span>}
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="h-20" /> {/* Bottom nav spacer */}
    </div>
  )
}
