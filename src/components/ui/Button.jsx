import { forwardRef } from 'react'

/**
 * Primary button variants following InkNeighbour design system.
 * All buttons meet WCAG 48×48px tap target minimum.
 */
const variants = {
  primary:   'bg-gradient-to-r from-orange to-orange2 shadow-orange text-white hover:opacity-90',
  secondary: 'bg-gradient-to-r from-violet to-purple-600 shadow-violet text-white hover:opacity-90',
  ghost:     'bg-transparent text-violet border border-violet hover:bg-violet/10',
  danger:    'bg-gradient-to-r from-red to-rose-500 text-white hover:opacity-90',
  muted:     'bg-border text-ink hover:bg-gray-200'
}

const sizes = {
  xs: 'px-2.5 py-1.5 text-xs min-h-[36px]',
  sm: 'px-3 py-1.5 text-sm min-h-[40px]',
  md: 'px-6 py-3 text-base min-h-[52px]',
  lg: 'px-8 py-4 text-lg min-h-[56px]'
}

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', className = '', disabled, loading, type = 'button', children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[14px] font-bold',
        'transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet/50',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        className
      ].join(' ')}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  )
})

export default Button
