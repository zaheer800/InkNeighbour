import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardJobs from '../../../pages/Dashboard/index'
import { supabase } from '../../../lib/supabase'

// ── Hook mocks ────────────────────────────────────────────────────────────────
vi.mock('../../../hooks/useAuth', () => ({
  useAuth: () => ({
    session: { user: { id: 'uid-1', email: 'owner@test.com' } },
    user: { id: 'uid-1', email: 'owner@test.com' },
    loading: false,
    signOut: vi.fn()
  })
}))

const mockFetchOwner = vi.fn()
let ownerState = { owner: null, loading: false }

vi.mock('../../../hooks/useOwner', () => ({
  useOwner: () => ({
    owner: ownerState.owner,
    loading: ownerState.loading,
    isSoftLocked: false,
    toggleStatus: vi.fn(),
    fetchOwner: mockFetchOwner
  })
}))

vi.mock('../../../hooks/useJobs', () => ({
  useJobs: () => ({ jobs: [], loading: false, fetchJobs: vi.fn() })
}))

vi.mock('../../../hooks/useReliability', () => ({
  useReliability: () => ({
    score: 0, grade: 'N/A', hasEnoughData: false, streak: 0,
    acceptanceRate: 0, completionRate: 0,
    isSoftLocked: false, refetch: vi.fn()
  })
}))

// ── Heavy component stubs ─────────────────────────────────────────────────────
vi.mock('../../../components/DashboardNav', () => ({ default: () => null }))
vi.mock('../../../components/JobCard', () => ({ default: () => null }))
vi.mock('../../../components/SLACountdown', () => ({ default: () => null }))
vi.mock('../../../components/ReliabilityScore', () => ({ default: () => null }))
vi.mock('../../../components/PreCommitmentPrompt', () => ({ default: () => null }))
vi.mock('../../../notifications/index', () => ({ setupOwnerPush: vi.fn() }))
vi.mock('../../../notifications/whatsapp', () => ({ buildShopShareLink: vi.fn().mockReturnValue('#') }))

// getUser is not in setup.js — add it here
supabase.auth.getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'uid-1' } } })

function makeChain(data = null, error = null) {
  const chain = {
    data, error,
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
    select: vi.fn(), eq: vi.fn(), single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn(), update: vi.fn(), not: vi.fn()
  }
  chain.select.mockReturnValue(chain); chain.eq.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain); chain.update.mockReturnValue(chain)
  return chain
}

function renderDashboard() {
  return render(<MemoryRouter><DashboardJobs /></MemoryRouter>)
}

afterEach(() => { localStorage.clear(); vi.clearAllMocks() })

describe('Dashboard — no owner, no reg_pending', () => {
  beforeEach(() => { ownerState = { owner: null, loading: false } })

  it('shows "Shop setup incomplete" when no owner row and no reg_pending', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText(/shop setup incomplete/i)).toBeInTheDocument()
    )
  })
})

describe('Dashboard — auto-complete (reg_pending present, new society)', () => {
  const pending = {
    isNewSociety: true,
    societyName: 'Sunrise Heights',
    societyPostalCode: '110002',
    name: 'Test Owner', phone: '9876543210', country_code: 'IN',
    shop_name: 'Sunrise Heights Print Shop',
    bw_rate: 200, color_rate: 500, delivery_fee: 800,
    upi_id: null, accept_cash: true
  }

  beforeEach(() => {
    ownerState = { owner: null, loading: false }
    localStorage.setItem('reg_pending', JSON.stringify(pending))

    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'uid-1' } } })

    const societiesChain = makeChain({ id: 'new-soc-id' })
    const ownersChain = makeChain()
    vi.mocked(supabase.from).mockImplementation((table) =>
      table === 'societies' ? societiesChain : ownersChain
    )
  })

  it('shows the "Finishing your shop setup…" spinner while completing', async () => {
    renderDashboard()
    expect(screen.getByText(/finishing your shop setup/i)).toBeInTheDocument()
  })

  it('calls supabase.from("societies") to create the society', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('societies')
    )
  })

  it('calls supabase.from("owners") to create the owner', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('owners')
    )
  })
})

describe('Dashboard — auto-complete (reg_pending present, existing society)', () => {
  const pending = {
    isNewSociety: false,
    societyId: 'soc-uuid-1',
    name: 'Test Owner', phone: '9876543210', country_code: 'IN',
    shop_name: 'My Print Shop',
    bw_rate: 200, color_rate: 500, delivery_fee: 800,
    upi_id: null, accept_cash: true
  }

  beforeEach(() => {
    ownerState = { owner: null, loading: false }
    localStorage.setItem('reg_pending', JSON.stringify(pending))
    vi.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'uid-1' } } })
    vi.mocked(supabase.from).mockReturnValue(makeChain())
  })

  it('does NOT call supabase.from("societies") when society already exists', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('owners')
    )
    expect(vi.mocked(supabase.from)).not.toHaveBeenCalledWith('societies')
  })
})

describe('Dashboard — pending owner banner', () => {
  beforeEach(() => {
    ownerState = {
      loading: false,
      owner: {
        id: 'o-1', status: 'pending', shop_name: 'Test Shop',
        country_code: 'IN', soft_lock_until: null,
        societies: { slug: 'test-shop-110001', name: 'Test Society' }
      }
    }
  })

  it('shows "Your shop is under review" banner when status is pending', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText(/your shop is under review/i)).toBeInTheDocument()
    )
  })

  it('does not show the toggle (Go live) button when pending', async () => {
    renderDashboard()
    await waitFor(() => screen.getByText(/your shop is under review/i))
    expect(screen.queryByRole('button', { name: /go live/i })).not.toBeInTheDocument()
  })

  it('shows "Awaiting approval" status text', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument()
    )
  })
})

describe('Dashboard — active owner', () => {
  beforeEach(() => {
    ownerState = {
      loading: false,
      owner: {
        id: 'o-1', status: 'active', shop_name: 'Test Shop',
        country_code: 'IN', soft_lock_until: null,
        societies: { slug: 'test-shop-110001', name: 'Test Society' }
      }
    }
  })

  it('shows the shop name in the nav', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText('Test Shop')).toBeInTheDocument()
    )
  })

  it('shows "Pause" button when shop is active', async () => {
    renderDashboard()
    await waitFor(() =>
      expect(screen.getByText(/pause/i)).toBeInTheDocument()
    )
  })
})
