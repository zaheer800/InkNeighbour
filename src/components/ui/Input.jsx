import { forwardRef, useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

const Input = forwardRef(function Input(
  { label, error, hint, className = '', wrapperClassName = '', id: idProp, type, ...props },
  ref
) {
  const generatedId = useId()
  const id = idProp || generatedId
  const [showPassword, setShowPassword] = useState(false)
  const isPassword = type === 'password'

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={id} className="text-base font-semibold text-ink">
          {label}
          {props.required && <span className="text-red ml-1">*</span>}
        </label>
      )}
      <div className={isPassword ? 'relative' : undefined}>
        <input
          ref={ref}
          id={id}
          type={isPassword ? (showPassword ? 'text' : 'password') : type}
          className={[
            'w-full min-h-[52px] px-4 py-3 rounded-xl border text-base text-ink',
            'placeholder:text-muted bg-surface',
            'focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet',
            'transition-colors duration-150',
            error ? 'border-red bg-red/5' : 'border-border',
            isPassword ? 'pr-12' : '',
            className
          ].join(' ')}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword(v => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
})

export default Input
