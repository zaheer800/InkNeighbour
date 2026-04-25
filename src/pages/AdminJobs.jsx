import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronLeft, LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { formatCurrency } from '../lib/countries'
import AppNav from '../components/AppNav'
import Footer from '../components/Footer'
import Badge from '../components/ui/Badge'

const STATUS_COLORS = {
  submitted:        'bg-amber/10 text-amber',
  accepted:         'bg-violet/10 text-violet',
  printing:         'bg-sky/10 text-sky',
  delivered:        'bg-green/10 text-green',
  cancelled:        'bg-red/10 text-red',
  feedback_pending: 'bg-amber/10 text-amber',
  feedback_done:    'bg-green/10 text-green',
}

const fmt = v => formatCurrency(v, 'IN')

function timeLabel(date) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  }).format(new Date(date))
}

export default function AdminJobs() {
  const { signOut } = useAuth()
  const [searchParams] = useSearchParams()
  const period = searchParams.get('period') || 'today'

  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  const isMonth = period === 'month'
  const title = isMonth ? 'GMV This Month' : 'Jobs Today'

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('jobs')
        .select('id, job_number, total_amount, status, created_at, print_type, copies, page_count, customer_name, customer_flat, owners(name, shop_name, societies(name))')
        .order('created_at', { ascending: false })

      const all = data || []
      const today = new Date().toDateString()
      const monthStart = new Date(); monthStart.setDate(1)

      const filtered = isMonth
        ? all.filter(j => j.status === 'delivered' && new Date(j.created_at) >= monthStart)
        : all.filter(j => new Date(j.created_at).toDateString() === today)

      setJobs(filtered)
      setLoading(false)
    }
    load()
  }, [isMonth])

  const total = jobs.reduce((s, j) => s + j.total_amount, 0)

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <AppNav wide right={
        <button onClick={signOut} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-medium min-h-[44px] px-2">
          <LogOut size={18} /> Sign out
        </button>
      } />

      <div className="border-b border-border bg-surface px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Link to="/admin" className="text-muted hover:text-ink transition-colors p-1 -ml-1 min-h-[44px] flex items-center">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="font-display text-xl font-bold text-ink">{title}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 w-full">

        {/* Summary */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-xl shadow-card p-4 text-center">
            <p className="font-display text-3xl font-black text-ink">{jobs.length}</p>
            <p className="text-sm text-muted mt-1">{isMonth ? 'Delivered jobs' : 'Total jobs'}</p>
          </div>
          <div className="bg-surface rounded-xl shadow-card p-4 text-center">
            <p className="font-display text-3xl font-black text-ink">{fmt(total)}</p>
            <p className="text-sm text-muted mt-1">{isMonth ? 'GMV' : 'Total value'}</p>
          </div>
        </div>

        {/* Jobs list */}
        {loading ? (
          <p className="text-center text-muted py-12">Loading…</p>
        ) : jobs.length === 0 ? (
          <p className="text-center text-muted py-12">No jobs found for this period.</p>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div key={job.id} className="bg-surface rounded-xl shadow-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-ink text-sm">{job.job_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[job.status] || 'bg-border text-muted'}`}>
                        {job.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-muted mt-0.5 truncate">
                      {job.owners?.shop_name || job.owners?.name}
                      {job.owners?.societies?.name ? ` · ${job.owners.societies.name}` : ''}
                    </p>
                  </div>
                  <p className="font-bold text-ink shrink-0">{fmt(job.total_amount)}</p>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted flex-wrap">
                  <span>{job.customer_name}{job.customer_flat ? `, Flat ${job.customer_flat}` : ''}</span>
                  <span className="uppercase font-medium text-violet">{job.print_type}</span>
                  <span>{job.page_count}p × {job.copies}</span>
                  <span className="ml-auto">{timeLabel(job.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
