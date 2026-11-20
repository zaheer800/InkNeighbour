import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, BarChart2, MessageSquare, Settings, Clock, Printer, Store, MoreHorizontal } from 'lucide-react'
import Modal from './ui/Modal'

const PRIMARY_ITEMS = [
  { to: '/dashboard',          icon: ClipboardList, label: 'Jobs'     },
  { to: '/dashboard/earnings', icon: BarChart2,     label: 'Earnings' },
  { to: '/printers',           icon: Printer,       label: 'Printers' },
  { to: '/dashboard/profile',  icon: Store,         label: 'Shop'     }
]

const MORE_ITEMS = [
  { to: '/dashboard/feedback',     icon: MessageSquare, label: 'Feedback' },
  { to: '/dashboard/availability', icon: Clock,         label: 'Hours'    },
  { to: '/dashboard/settings',     icon: Settings,      label: 'Settings' }
]

function NavLink({ to, icon: Icon, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={[
        'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors min-h-[56px]',
        active ? 'text-violet' : 'text-muted hover:text-ink'
      ].join(' ')}
    >
      <Icon size={20} />
      {label}
    </Link>
  )
}

export default function DashboardNav() {
  const { pathname } = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const moreActive = MORE_ITEMS.some(item => pathname === item.to)

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-30">
        {PRIMARY_ITEMS.map(item => (
          <NavLink key={item.to} {...item} active={pathname === item.to} />
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className={[
            'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors min-h-[56px]',
            moreActive ? 'text-violet' : 'text-muted hover:text-ink'
          ].join(' ')}
        >
          <MoreHorizontal size={20} />
          More
        </button>
      </nav>
      <div className="h-20" />

      <Modal open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <div className="flex flex-col gap-2">
          {MORE_ITEMS.map(item => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMoreOpen(false)}
              className={[
                'flex items-center gap-3 px-4 rounded-xl font-semibold transition-colors min-h-[52px]',
                pathname === item.to ? 'bg-bg text-violet' : 'text-ink hover:bg-bg'
              ].join(' ')}
            >
              <item.icon size={24} />
              {item.label}
            </Link>
          ))}
        </div>
      </Modal>
    </>
  )
}
