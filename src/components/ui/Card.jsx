/**
 * Surface card container following InkNeighbour design system.
 */
export default function Card({ children, className = '', onClick }) {
  const isClickable = typeof onClick === 'function'
  return (
    <div
      onClick={onClick}
      className={[
        'bg-surface rounded-xl shadow-card p-5',
        isClickable ? 'cursor-pointer hover:shadow-md transition-shadow duration-150' : '',
        className
      ].join(' ')}
    >
      {children}
    </div>
  )
}
