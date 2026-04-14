import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BarChart2, MessageSquare, Settings } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useOwner } from '../../hooks/useOwner'
import { StarDisplay } from '../../components/StarRating'
import StarRating from '../../components/StarRating'

export default function DashboardFeedback() {
  const { t } = useTranslation()
  const { owner } = useOwner()
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!owner) return
    supabase
      .from('feedback')
      .select('*, jobs(job_number, created_at)')
      .eq('owner_id', owner.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFeedback(data || [])
        setLoading(false)
      })
  }, [owner])

  const avgRating = feedback.length > 0
    ? (feedback.reduce((s, f) => s + f.star_rating, 0) / feedback.length).toFixed(1)
    : null

  const onTimePct = feedback.length > 0
    ? Math.round((feedback.filter(f => f.on_time).length / feedback.length) * 100)
    : null

  const qualityPct = feedback.length > 0
    ? Math.round((feedback.filter(f => f.quality_good).length / feedback.length) * 100)
    : null

  return (
    <div className="min-h-screen bg-bg pb-24">
      {/* Header */}
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-2xl mx-auto">
          <h1 className="font-display text-3xl font-bold">{t('feedback_dashboard.title')}</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        {/* Summary card */}
        {feedback.length > 0 && (
          <div className="bg-ink2 text-white rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="font-display text-5xl font-black">{avgRating}</p>
                <p className="text-white/60 text-sm">{t('feedback_dashboard.avg_rating')}</p>
              </div>
              <StarRating value={Math.round(parseFloat(avgRating || '0'))} readOnly size="sm" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{feedback.length}</p>
                <p className="text-xs text-white/60">{t('feedback_dashboard.total_ratings')}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{onTimePct}%</p>
                <p className="text-xs text-white/60">{t('feedback_dashboard.on_time')}</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3 text-center">
                <p className="text-xl font-bold">{qualityPct}%</p>
                <p className="text-xs text-white/60">{t('feedback_dashboard.quality')}</p>
              </div>
            </div>
          </div>
        )}

        {/* Individual feedback list */}
        {loading ? (
          <p className="text-center text-muted py-12">{t('common.loading')}</p>
        ) : feedback.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-4xl">⭐</p>
            <p className="text-muted">{t('feedback_dashboard.empty')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedback.map(f => (
              <div key={f.id} className="bg-surface rounded-xl shadow-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-ink">#{f.jobs?.job_number}</p>
                    <p className="text-sm text-muted">
                      {new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(new Date(f.created_at))}
                    </p>
                  </div>
                  <StarRating value={f.star_rating} readOnly size="sm" />
                </div>
                <div className="flex gap-3 text-sm">
                  <span className={`px-3 py-1 rounded-pill font-medium ${f.on_time ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
                    {f.on_time ? '👍 On time' : '👎 Late'}
                  </span>
                  <span className={`px-3 py-1 rounded-pill font-medium ${f.quality_good ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
                    {f.quality_good ? '👍 Good quality' : '👎 Quality issue'}
                  </span>
                </div>
                {f.comment && (
                  <p className="text-sm text-muted italic">"{f.comment}"</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-30">
        {[
          { to: '/dashboard', label: 'Jobs', emoji: '📋' },
          { to: '/dashboard/earnings', label: 'Earnings', icon: BarChart2 },
          { to: '/dashboard/feedback', label: 'Feedback', active: true, icon: MessageSquare },
          { to: '/dashboard/settings', label: 'Settings', icon: Settings }
        ].map(item => (
          <Link
            key={item.to}
            to={item.to}
            className={[
              'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors min-h-[56px]',
              item.active ? 'text-violet' : 'text-muted hover:text-ink'
            ].join(' ')}
          >
            {item.icon ? <item.icon size={20} /> : <span className="text-base">{item.emoji}</span>}
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
