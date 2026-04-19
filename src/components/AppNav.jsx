import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function AppNav({ right, left, wide = false, back }) {
  return (
    <nav style={{ backgroundColor: '#1A1A2E' }} className="text-white sticky top-0 z-40 border-b border-white/10">
      <div className={`${wide ? 'max-w-4xl' : 'max-w-2xl'} mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-4`}>
        {left ?? (
          <Link
            to={back ?? '/'}
            className="font-display font-black text-[22px] tracking-tight shrink-0 flex items-center gap-2"
          >
            {back && <ArrowLeft size={18} className="text-white/50" strokeWidth={2.5} />}
            <span>Ink<span className="text-orange">Neighbour</span></span>
          </Link>
        )}
        {right && <div className="flex items-center">{right}</div>}
      </div>
    </nav>
  )
}
