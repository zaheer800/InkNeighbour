import { useState } from 'react'
import { Star } from 'lucide-react'

/**
 * Interactive star rating — elder-friendly with 40px+ tap targets.
 */
export default function StarRating({ value = 0, onChange, readOnly = false, size = 'md' }) {
  const [hovered, setHovered] = useState(0)

  const starSize = size === 'lg' ? 40 : size === 'sm' ? 20 : 32

  return (
    <div className="flex gap-1" role="group" aria-label="Star rating">
      {[1, 2, 3, 4, 5].map(star => {
        const filled = readOnly ? star <= value : star <= (hovered || value)
        return (
          <button
            key={star}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(star)}
            onMouseEnter={() => !readOnly && setHovered(star)}
            onMouseLeave={() => !readOnly && setHovered(0)}
            className={[
              'p-1 rounded-xl transition-transform duration-100',
              !readOnly && 'hover:scale-110 active:scale-95 cursor-pointer',
              readOnly && 'cursor-default'
            ].filter(Boolean).join(' ')}
            style={{ minWidth: starSize + 8, minHeight: starSize + 8 }}
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <Star
              size={starSize}
              className={filled ? 'text-amber fill-amber' : 'text-border'}
            />
          </button>
        )
      })}
    </div>
  )
}

/**
 * Read-only star display for shop pages and search results.
 */
export function StarDisplay({ rating, count, className = '' }) {
  if (!rating || !count || count < 3) return null

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-semibold text-ink ${className}`}>
      <Star size={16} className="text-amber fill-amber" />
      {rating.toFixed(1)} · {count} ratings
    </span>
  )
}
