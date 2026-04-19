import { Link, useLocation } from 'react-router-dom'
import { ClipboardList, BarChart2, MessageSquare, Settings, Clock } from 'lucide-react'

const ITEMS = [
  { to: '/dashboard',              icon: ClipboardList, label: 'Jobs'      },
  { to: '/dashboard/earnings',     icon: BarChart2,     label: 'Earnings'  },
  { to: '/dashboard/feedback',     icon: MessageSquare, label: 'Feedback'  },
  { to: '/dashboard/availability', icon: Clock,         label: 'Hours'     },
  { to: '/dashboard/settings',     icon: Settings,      label: 'Settings'  }
]

export default function DashboardNav() {
  const { pathname } = useLocation()

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border flex z-30">
        {ITEMS.map(item => {
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={[
                'flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-semibold transition-colors min-h-[56px]',
                active ? 'text-violet' : 'text-muted hover:text-ink'
              ].join(' ')}
            >
              <item.icon size={20} />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="h-20" />
    </>
  )
}
