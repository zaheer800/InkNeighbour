import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Printer, Star } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/countries'
import Badge from '../components/ui/Badge'
import { StarDisplay } from '../components/StarRating'
import Button from '../components/ui/Button'

export default function Find() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const pincode = searchParams.get('pincode') || ''
  const [shops, setShops] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!pincode) { setLoading(false); return }

    supabase
      .from('owners')
      .select(`
        id, name, shop_name, status, bw_rate, color_rate, delivery_fee, country_code,
        societies!inner(id, name, slug, city, state, postal_code),
        feedback(star_rating)
      `)
      .eq('societies.postal_code', pincode)
      .neq('status', 'inactive')
      .then(({ data }) => {
        setShops(data || [])
        setLoading(false)
      })
  }, [pincode])

  function getAggregateRating(feedback) {
    if (!feedback?.length || feedback.length < 3) return null
    const avg = feedback.reduce((sum, f) => sum + f.star_rating, 0) / feedback.length
    return { avg: avg.toFixed(1), count: feedback.length }
  }

  return (
    <div className="min-h-screen bg-bg">
      {/* Header */}
      <div className="page-hero px-4 py-10 text-white relative">
        <div className="relative z-10 max-w-2xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <h1 className="font-display text-3xl font-bold">
            {t('find.title', { pincode })}
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {loading ? (
          <p className="text-center text-muted py-12">{t('find.loading')}</p>
        ) : shops.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-muted/10 rounded-xl flex items-center justify-center mx-auto">
              <Printer size={32} className="text-muted" />
            </div>
            <h2 className="font-bold text-xl text-ink">{t('find.empty_title')}</h2>
            <p className="text-muted">{t('find.empty_desc')}</p>
            <Link to="/register">
              <Button className="mt-2">{t('nav.register')}</Button>
            </Link>
          </div>
        ) : (
          shops.map(shop => {
            const rating = getAggregateRating(shop.feedback)
            const society = shop.societies
            const countryCode = shop.country_code || 'IN'
            const fmt = v => formatCurrency(v, countryCode)

            return (
              <div key={shop.id} className="bg-surface rounded-xl shadow-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="font-bold text-xl text-ink">{shop.shop_name || society.name + ' Print Shop'}</h2>
                    <p className="text-muted text-sm">{t('find.managed_by', { name: shop.name.split(' ')[0] })}</p>
                    {society.city && <p className="text-sm text-muted">{society.city}{society.state ? `, ${society.state}` : ''}</p>}
                  </div>
                  <Badge status={shop.status} />
                </div>

                {/* Rates */}
                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="bg-bg px-3 py-1 rounded-pill font-medium text-ink">
                    {t('find.bw_rate', { rate: fmt(shop.bw_rate) })}
                  </span>
                  <span className="bg-bg px-3 py-1 rounded-pill font-medium text-ink">
                    {t('find.color_rate', { rate: fmt(shop.color_rate) })}
                  </span>
                  <span className="bg-bg px-3 py-1 rounded-pill font-medium text-ink">
                    {shop.delivery_fee > 0
                      ? t('find.delivery', { fee: fmt(shop.delivery_fee) })
                      : 'Free delivery'}
                  </span>
                </div>

                {rating && (
                  <StarDisplay rating={parseFloat(rating.avg)} count={rating.count} />
                )}

                <Link to={`/${society.slug}`}>
                  <Button className="w-full">
                    {t('find.order_cta')}
                  </Button>
                </Link>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
