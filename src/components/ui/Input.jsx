import { forwardRef, useId } from 'react'

/**
 * Elder-friendly input — min 52px height, 18px+ font, clear label.
 * Uses useId for accessible label/input association (htmlFor + id).
 */
const Input = forwardRef(function Input(
  { label, error, hint, className = '', wrapperClassName = '', id: idProp, ...props },
  ref
) {
  const generatedId = useId()
  const id = idProp || generatedId

  return (
    <div className={`flex flex-col gap-1.5 ${wrapperClassName}`}>
      {label && (
        <label htmlFor={id} className="text-base font-semibold text-ink">
          {label}
          {props.required && <span className="text-red ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        id={id}
        className={[
          'w-full min-h-[52px] px-4 py-3 rounded-xl border text-base text-ink',
          'placeholder:text-muted bg-surface',
          'focus:outline-none focus:ring-2 focus:ring-violet/40 focus:border-violet',
          'transition-colors duration-150',
          error ? 'border-red bg-red/5' : 'border-border',
          className
        ].join(' ')}
        {...props}
      />
      {error && <p className="text-sm text-red">{error}</p>}
      {hint && !error && <p className="text-sm text-muted">{hint}</p>}
    </div>
  )
})

export default Input
