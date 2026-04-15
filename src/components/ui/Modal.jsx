import { useEffect } from 'react'
import { X } from 'lucide-react'

/**
 * Accessible modal dialog with backdrop.
 */
export default function Modal({ open, onClose, title, children, className = '' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className={`relative bg-surface rounded-xl shadow-xl w-full max-w-md p-6 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          {title && (
            <h2 id="modal-title" className="text-xl font-bold text-ink font-display">
              {title}
            </h2>
          )}
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-xl text-muted hover:text-ink hover:bg-bg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
