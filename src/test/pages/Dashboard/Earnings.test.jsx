import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardEarnings from '../../../pages/Dashboard/Earnings'
import { supabase } from '../../../lib/supabase'
import { formatCurrency } from '../../../lib/countries'

vi.mock('../../../components/DashboardNav', () => ({ default: () => null }))
vi.mock('../../../components/AppNav', () => ({ default: () => null }))

let ownerState = null
let jobsState = []

vi.mock('../../../hooks/useOwner', () => ({
  useOwner: () => ({ owner: ownerState }),
}))
vi.mock('../../../hooks/useJobs', () => ({
  useJobs: () => ({ jobs: jobsState }),
}))

function makeChain(data = null, error = null) {
  const chain = {
    data, error,
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
    select: vi.fn(), eq: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  return chain
}

function deliveredJob({ printType = 'bw', pages = 10, copies = 1, totalAmount = 1000 }) {
  return {
    id: 'job-1', status: 'delivered', updated_at: new Date().toISOString(),
    print_type: printType, page_count: pages, copies, total_amount: totalAmount,
  }
}

function renderPage() {
  return render(<MemoryRouter><DashboardEarnings /></MemoryRouter>)
}

afterEach(() => { vi.clearAllMocks() })

describe('Earnings — no cost inputs configured', () => {
  beforeEach(() => {
    ownerState = { id: 'owner-1', country_code: 'IN', bw_rate: 200, color_rate: 500 }
    jobsState = [deliveredJob({ pages: 10 })]
    vi.mocked(supabase.from).mockReturnValue(makeChain([]))
  })

  it('shows a setup prompt instead of a net profit figure', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('earnings.costs_setup_prompt')).toBeInTheDocument())
    expect(screen.queryByText('earnings.net_profit')).not.toBeInTheDocument()
  })
})

describe('Earnings — cartridge configured', () => {
  beforeEach(() => {
    ownerState = {
      id: 'owner-1', country_code: 'IN', bw_rate: 200, color_rate: 500,
      bw_ink_cost_per_page: 60, // 60 paise/page
    }
    jobsState = [deliveredJob({ printType: 'bw', pages: 100, totalAmount: 5000 })]
    vi.mocked(supabase.from).mockReturnValue(makeChain([]))
  })

  it('computes ink cost estimate from pages printed, not a typed-in number', async () => {
    renderPage()
    // 100 bw pages * 60 paise = 6000 paise = ₹60
    await waitFor(() => expect(screen.getByText(formatCurrency(6000, 'IN'))).toBeInTheDocument())
    expect(screen.getByText('earnings.net_profit')).toBeInTheDocument()
    // Net profit = 5000 (earned) - 6000 (ink cost) = -1000
    expect(screen.getByText(formatCurrency(-1000, 'IN'))).toBeInTheDocument()
  })
})

describe('Earnings — paper cost configured', () => {
  beforeEach(() => {
    ownerState = {
      id: 'owner-1', country_code: 'IN', bw_rate: 200, color_rate: 500,
      paper_cost_per_page: 60, // 60 paise/page
    }
    jobsState = [deliveredJob({ printType: 'bw', pages: 50, totalAmount: 2000 })]
    vi.mocked(supabase.from).mockReturnValue(makeChain([]))
  })

  it('computes paper cost estimate from pages printed', async () => {
    renderPage()
    // 50 pages * 60 paise = 3000 paise = ₹30
    await waitFor(() => expect(screen.getByText(formatCurrency(3000, 'IN'))).toBeInTheDocument())
  })
})

describe('Earnings — other recurring expenses configured', () => {
  beforeEach(() => {
    ownerState = {
      id: 'owner-1', country_code: 'IN', bw_rate: 200, color_rate: 500,
      created_at: new Date(Date.now() - 400 * 86400000).toISOString(), // well over a year old
    }
    jobsState = [deliveredJob({ printType: 'bw', pages: 10, totalAmount: 1000 })]
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'owner_expenses') return makeChain([{ monthly_amount: 300000 }]) // ₹3000/month
      return makeChain([])
    })
  })

  it("prorates the monthly expense by the selected period's days, not a flat monthly figure", async () => {
    renderPage()
    // "Today" period (default) = 1 day → 300000/30*1 = 10000 paise = ₹100
    await waitFor(() => expect(screen.getByText('earnings.other_expenses_period')).toBeInTheDocument())
    expect(screen.getByText(formatCurrency(10000, 'IN'))).toBeInTheDocument()
  })
})
