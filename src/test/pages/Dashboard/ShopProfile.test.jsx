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
  id: 'owner-1', provider_type: 'shop', shop_name: 'Quick Print', slug: 'quick-print',
  description: 'Fast printing near the metro', banner_url: null,
  shop_address: '12 Main St', locality: 'Tarnaka', landmark: '', gst_number: '',
  lat: 17.4, lng: 78.5, bw_rate: 200, color_rate: 500, delivery_fee: 0,
  bw_ink_cost_per_page: 45, color_ink_cost_per_page: 300, paper_cost_per_page: 60,
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

const EXPENSE_ROWS = [
  { id: 'e1', owner_id: 'owner-1', name: 'Rent', monthly_amount: 500000 },
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
      if (table === 'owner_expenses') return makeChain(EXPENSE_ROWS)
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

  it('pre-fills ink and paper cost-per-page fields from the owner row', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByDisplayValue('0.45')).toBeInTheDocument())
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0.6')).toBeInTheDocument()
  })

  it('includes ink and paper cost-per-page fields in the save payload', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.save_shop_info')).toBeInTheDocument())
    screen.getByText('shop_profile.save_shop_info').click()
    await waitFor(() => expect(mockUpdateOwner).toHaveBeenCalled())
    const updates = mockUpdateOwner.mock.calls[0][0]
    expect(updates.bw_ink_cost_per_page).toBe(45)
    expect(updates.color_ink_cost_per_page).toBe(300)
    expect(updates.paper_cost_per_page).toBe(60)
  })

  it('inserts a new custom service row when added via the manual form', async () => {
    // Initial load resolves via chain.then() with the array of existing rows;
    // the insert flow resolves via the separate chain.single() mock below.
    const insertChain = makeChain(SERVICE_ROWS)
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 's7', owner_id: 'owner-1', service_code: 'custom_new', name: 'Typing', is_preset: false, is_enabled: true, display_price: null },
      error: null,
    })
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'service_menu') return insertChain
      if (table === 'delivery_fee_tiers') return makeChain(TIER_ROWS)
      return makeChain()
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.add_own_service')).toBeInTheDocument())
    await userEvent.click(screen.getByText('shop_profile.add_own_service'))
    const nameInput = screen.getByPlaceholderText('shop_profile.custom_name_placeholder')
    await userEvent.type(nameInput, 'Typing')
    await userEvent.click(screen.getByText('shop_profile.add_service_submit'))
    await waitFor(() => expect(insertChain.insert).toHaveBeenCalled())
  })

  it('inserts a service immediately when a suggestion chip is tapped', async () => {
    const insertChain = makeChain(SERVICE_ROWS)
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 's7', owner_id: 'owner-1', service_code: 'custom_new', name: 'Stapling', is_preset: false, is_enabled: true, display_price: null },
      error: null,
    })
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'service_menu') return insertChain
      if (table === 'delivery_fee_tiers') return makeChain(TIER_ROWS)
      return makeChain()
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Stapling')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Stapling'))
    await waitFor(() => expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Stapling', is_preset: false, is_enabled: true })
    ))
  })

  it('does not suggest a service that has already been added', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.suggested_services_title')).toBeInTheDocument())
    // "Spiral binding" already exists as a custom service in SERVICE_ROWS — the
    // suggestion list uses "Spiral Binding" (different case) and must not duplicate it.
    expect(screen.queryByText('Spiral Binding')).not.toBeInTheDocument()
  })

  it('shows existing expenses and does not suggest one already added', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('Rent')).toBeInTheDocument())
    expect(screen.getByText('shop_profile.expenses_suggested_title')).toBeInTheDocument()
    // "Rent" is already in EXPENSE_ROWS — must not also appear as a suggestion chip.
    expect(screen.queryByRole('button', { name: /Rent/ })).not.toBeInTheDocument()
  })

  it('inserts an expense immediately when a suggestion chip is tapped', async () => {
    const insertChain = makeChain(EXPENSE_ROWS)
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 'e2', owner_id: 'owner-1', name: 'Electricity', monthly_amount: 0 },
      error: null,
    })
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'service_menu') return makeChain(SERVICE_ROWS)
      if (table === 'delivery_fee_tiers') return makeChain(TIER_ROWS)
      if (table === 'owner_expenses') return insertChain
      return makeChain()
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('Electricity')).toBeInTheDocument())
    await userEvent.click(screen.getByText('Electricity'))
    await waitFor(() => expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Electricity', monthly_amount: 0 })
    ))
  })

  it('adds a custom expense via the manual form', async () => {
    const insertChain = makeChain(EXPENSE_ROWS)
    insertChain.single = vi.fn().mockResolvedValue({
      data: { id: 'e3', owner_id: 'owner-1', name: 'Water bill', monthly_amount: 0 },
      error: null,
    })
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'service_menu') return makeChain(SERVICE_ROWS)
      if (table === 'delivery_fee_tiers') return makeChain(TIER_ROWS)
      if (table === 'owner_expenses') return insertChain
      return makeChain()
    })
    renderPage()
    await waitFor(() => expect(screen.getByText('shop_profile.add_own_expense')).toBeInTheDocument())
    await userEvent.click(screen.getByText('shop_profile.add_own_expense'))
    await userEvent.type(screen.getByPlaceholderText('shop_profile.expense_name_placeholder'), 'Water bill')
    await userEvent.click(screen.getByText('shop_profile.add_expense_submit'))
    await waitFor(() => expect(insertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Water bill' })
    ))
  })

  it('shows the shop link with a copy button and a QR code button', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText(/quick-print/)).toBeInTheDocument())
    expect(screen.getByText('earnings.qr_button')).toBeInTheDocument()
  })

  it('opens the printable QR view when the QR button is tapped', async () => {
    renderPage()
    await waitFor(() => expect(screen.getByText('earnings.qr_button')).toBeInTheDocument())
    expect(screen.queryByText('earnings.qr_scan_hint')).not.toBeInTheDocument()
    await userEvent.click(screen.getByText('earnings.qr_button'))
    expect(screen.getByText('earnings.qr_scan_hint')).toBeInTheDocument()
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
