import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ShopProfile from '../../../pages/Dashboard/ShopProfile'
import { supabase } from '../../../lib/supabase'

vi.mock('../../../components/DashboardNav', () => ({ default: () => null }))
vi.mock('../../../components/ShopLocationMap', () => ({ default: () => null }))

const mockUpdateOwner = vi.fn().mockResolvedValue({ data: {}, error: null })
let ownerState = { owner: null, loading: false }

vi.mock('../../../hooks/useOwner', () => ({
  useOwner: () => ({
    owner: ownerState.owner,
    loading: ownerState.loading,
    updateOwner: mockUpdateOwner,
    fetchOwner: vi.fn(),
  })
}))

function makeChain(data = null, error = null) {
  const chain = {
    data, error,
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
    select: vi.fn(), eq: vi.fn(), order: vi.fn(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    insert: vi.fn(), update: vi.fn(), delete: vi.fn(), upsert: vi.fn(), in: vi.fn(),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.order.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  chain.delete.mockReturnValue(chain)
  chain.upsert.mockReturnValue(chain)
  chain.in.mockReturnValue(chain)
  return chain
}

const SHOP_OWNER = {
  id: 'owner-1', provider_type: 'shop', shop_name: 'Quick Print',
  description: 'Fast printing near the metro', banner_url: null,
  shop_address: '12 Main St', locality: 'Tarnaka', landmark: '', gst_number: '',
  lat: 17.4, lng: 78.5, bw_rate: 200, color_rate: 500, delivery_fee: 0,
}

const HOME_OWNER = {
  id: 'owner-2', provider_type: 'home', shop_name: 'Ravi Prints',
  description: '', banner_url: null,
  bw_rate: 200, color_rate: 500, delivery_fee: 800,
}

const SERVICE_ROWS = [
  { id: 's1', owner_id: 'owner-1', service_code: 'scan', is_enabled: true, display_price: '₹5', name: null, is_preset: true },
  { id: 's2', owner_id: 'owner-1', service_code: 'photocopy', is_enabled: false, display_price: null, name: null, is_preset: true },
  { id: 's3', owner_id: 'owner-1', service_code: 'binding', is_enabled: false, display_price: null, name: null, is_preset: true },
  { id: 's4', owner_id: 'owner-1', service_code: 'lamination', is_enabled: false, display_price: null, name: null, is_preset: true },
  { id: 's5', owner_id: 'owner-1', service_code: 'passport_photo', is_enabled: false, display_price: null, name: null, is_preset: true },
  { id: 's6', owner_id: 'owner-1', service_code: 'custom_abc123', is_enabled: true, display_price: '₹20', name: 'Spiral binding', is_preset: false },
]

const TIER_ROWS = [
  { id: 't1', max_km: '1.0', fee: 1500 },
  { id: 't2', max_km: '2.0', fee: 2500 },
]

function renderPage() {
  return render(<MemoryRouter><ShopProfile /></MemoryRouter>)
}

afterEach(() => { vi.clearAllMocks() })

describe('ShopProfile — loading / no owner', () => {
  beforeEach(() => { ownerState = { owner: null, loading: true } })

  it('shows loading state', () => {
    renderPage()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })
})

describe('ShopProfile — shop-type owner', () => {
  beforeEach(() => {
    ownerState = { owner: SHOP_OWNER, loading: false }
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'service_menu') return makeChain(SERVICE_ROWS)
      if (table === 'delivery_fee_tiers') return makeChain(TIER_ROWS)
      return makeChain()
    })
  })

  it('renders the page title', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.title')).toBeInTheDocument())
  })

  it('shows the banner upload prompt when no banner is set', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.upload_banner')).toBeInTheDocument())
  })

  it('pre-fills the description field from the owner row', async () => {
    renderPage()
    await waitFor(() => {
      const input = screen.getByDisplayValue('Fast printing near the metro')
      expect(input).toBeInTheDocument()
    })
  })

  it('shows shop address / map fields for a shop-type owner', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByDisplayValue('12 Main St')).toBeInTheDocument())
  })

  it('shows distance-band delivery tiers instead of a flat fee', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.add_tier')).toBeInTheDocument())
    expect(screen.queryByText('shop_profile.delivery_fee_home_label')).not.toBeInTheDocument()
  })

  it('shows preset service checkboxes and the custom service row', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Spiral binding')).toBeInTheDocument())
    expect(screen.getByText('Scanning')).toBeInTheDocument()
  })

  it('calls updateOwner with shop fields (not the account-only fields) on save', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.save_shop_info')).toBeInTheDocument())
    screen.getByText('shop_profile.save_shop_info').click()
    await waitFor(() => expect(mockUpdateOwner).toHaveBeenCalled())
    const updates = mockUpdateOwner.mock.calls[0][0]
    expect(updates).toHaveProperty('description')
    expect(updates).toHaveProperty('shop_address')
    expect(updates).not.toHaveProperty('upi_id')
    expect(updates).not.toHaveProperty('accept_cash')
  })

  it('inserts a new custom service row when added', async () => {
    // Initial load resolves via chain.then() with the array of existing rows;
    // the insert flow resolves via the separate chain.single() mock below.
    const insertChain = makeChain(SERVICE_ROWS)
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 's7', owner_id: 'owner-1', service_code: 'custom_new', name: 'Spiral', is_preset: false, is_enabled: true, display_price: null },
      error: null,
    })
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'service_menu') return insertChain
      if (table === 'delivery_fee_tiers') return makeChain(TIER_ROWS)
      return makeChain()
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.add_custom_service')).toBeInTheDocument())
    await userEvent.click(screen.getByText('shop_profile.add_custom_service'))
    const nameInput = screen.getByPlaceholderText('shop_profile.custom_name_placeholder')
    await userEvent.type(nameInput, 'Spiral')
    await userEvent.click(screen.getByText('shop_profile.add_custom_service'))
    await waitFor(() => expect(insertChain.insert).toHaveBeenCalled())
  })
})

describe('ShopProfile — home-type owner', () => {
  beforeEach(() => {
    ownerState = { owner: HOME_OWNER, loading: false }
    vi.mocked(supabase.from).mockReturnValue(makeChain())
  })

  it('shows a flat delivery fee input instead of distance tiers', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.delivery_fee_home_label')).toBeInTheDocument())
    expect(screen.queryByText('shop_profile.add_tier')).not.toBeInTheDocument()
  })

  it('does not show the shop address / map section', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.title')).toBeInTheDocument())
    expect(screen.queryByText('settings.map_pin')).not.toBeInTheDocument()
  })

  it('does not show the service menu editor', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.title')).toBeInTheDocument())
    expect(screen.queryByText('settings.service_menu')).not.toBeInTheDocument()
  })
})
