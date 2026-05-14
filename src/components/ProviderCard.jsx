import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Home, Store, Clock } from 'lucide-react'
import { formatCurrency } from '../lib/countries'
import { StarDisplay } from './StarRating'
import Badge from './ui/Badge'
import Button from './ui/Button'

/**
 * Unified result card for Home Owners and Print Shops.
 *
 * Props:
 *   owner       – owner row with joined societies, feedback, delivery_fee_tiers
 *   slug        – URL slug to link to (society.slug for home, owner slug for shop)
 *   backHref    – href saved in sessionStorage so the shop page can navigate back
 *   isOpen      – optional boolean; undefined = omit open/closed indicator
 */
export default function ProviderCard({ owner, slug, backHref, isOpen }) {
  const { t } = useTranslation()

  const isShop      = owner.provider_type === 'shop'
  const country     = owner.country_code || 'IN'
  const fmt         = v => formatCurrency(v, country)

  const rating = getAggregateRating(owner.feedback)

  // Delivery copy
  let deliveryCopy
  if (isShop) {
    const tiers = owner.delivery_fee_tiers
    if (tiers?.length) {
      const minFee = Math.min(...tiers.map(t => t.fee))
      deliveryCopy = minFee === 0 ? t('find.free_delivery') : t('find.delivery_from', { fee: fmt(minFee) })
    } else if (owner.delivery_fee != null) {
      deliveryCopy = owner.delivery_fee > 0
        ? t('find.delivery', { fee: fmt(owner.delivery_fee) })
        : t('find.free_delivery')
    }
  } else {
    deliveryCopy = owner.delivery_fee > 0
      ? t('find.delivery', { fee: fmt(owner.delivery_fee) })
      : t('find.free_delivery')
  }

  // Location subtitle
  const society  = owner.societies
  const location = isShop
    ? [owner.locality, owner.landmark].filter(Boolean).join(' · ')
    : [society?.city, society?.state].filter(Boolean).join(', ')

  const shopTitle = owner.shop_name || (isShop ? owner.name : `${society?.name} Print Shop`)

  return (
    <div className="bg-surface rounded-xl shadow-card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {/* Provider type badge */}
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
              isShop
                ? 'bg-violet/10 text-violet'
                : 'bg-orange/10 text-orange'
            }`}>
              {isShop
                ? <><Store size={11} />{t('find.badge_shop')}</>
                : <><Home  size={11} />{t('find.badge_home')}</>
              }
            </span>

            {/* Open/closed indicator */}
            {isOpen !== undefined && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                isOpen ? 'bg-green/10 text-green' : 'bg-amber/10 text-amber'
              }`}>
                <Clock size={11} />
                {isOpen ? t('find.open_now') : t('find.closed_now')}
              </span>
            )}
          </div>

          <h2 className="font-bold text-xl text-ink leading-tight truncate">{shopTitle}</h2>
          <p className="text-muted text-sm">{t('find.managed_by', { name: owner.name.split(' ')[0] })}</p>
          {location && <p className="text-sm text-muted mt-0.5">{location}</p>}
        </div>

        <Badge status={owner.status} />
      </div>

      {/* Rates row */}
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="bg-bg px-3 py-1 rounded-pill font-medium text-ink">
          {t('find.bw_rate', { rate: fmt(owner.bw_rate) })}
        </span>
        <span className="bg-bg px-3 py-1 rounded-pill font-medium text-ink">
          {t('find.color_rate', { rate: fmt(owner.color_rate) })}
        </span>
        {deliveryCopy && (
          <span className="bg-bg px-3 py-1 rounded-pill font-medium text-ink">
            {deliveryCopy}
          </span>
        )}
      </div>

      {/* Star rating */}
      {rating && <StarDisplay rating={parseFloat(rating.avg)} count={rating.count} />}

      {/* CTA */}
      <Link
        to={`/${slug}`}
        className="block pt-1"
        onClick={() => backHref && sessionStorage.setItem('find_back', backHref)}
      >
        <Button className="w-full">{t('find.order_cta')}</Button>
      </Link>
    </div>
  )
}

function getAggregateRating(feedback) {
  if (!feedback?.length || feedback.length < 3) return null
  const avg = feedback.reduce((sum, f) => sum + f.star_rating, 0) / feedback.length
  return { avg: avg.toFixed(1), count: feedback.length }
}
