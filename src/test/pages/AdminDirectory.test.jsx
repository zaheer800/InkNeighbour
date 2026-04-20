import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AdminDirectory from '../../pages/AdminDirectory'
import { supabase } from '../../lib/supabase'

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ signOut: vi.fn() })
}))

vi.mock('../../components/AppNav', () => ({
  default: ({ left, right }) => <div>{left}{right}</div>
}))

vi.mock('../../components/Footer', () => ({ default: () => null }))
vi.mock('../../components/ui/Badge', () => ({
  default: ({ status }) => <span data-testid="badge">{status}</span>
}))

const MOCK_SHOPS = [
  {
    id: 'o-1', shop_name: 'Green Valley Prints', name: 'Zaheer Ahmed', phone: '9876543210',
    status: 'active', bw_rate: 200, color_rate: 500, delivery_fee: 800,
    accept_cash: true, upi_id: 'zaheer@upi',
    societies: { name: 'Green Valley', city: 'Delhi', state: 'DL', slug: 'green-valley-110001', postal_code: '110001' }
  },
  {
    id: 'o-2', shop_name: 'Sunrise Prints', name: 'Amir Khan', phone: '9988776655',
    status: 'pending', bw_rate: 200, color_rate: 500, delivery_fee: 0,
    accept_cash: false, upi_id: null,
    societies: { name: 'Sunrise Heights', city: 'Delhi', state: 'DL', slug: 'sunrise-heights-110002', postal_code: '110002' }
  }
]

const MOCK_SOCIETIES = [
  { id: 's-1', name: 'Green Valley', city: 'Delhi', state: 'DL', postal_code: '110001', slug: 'green-valley-110001' },
  { id: 's-2', name: 'Sunrise Heights', city: 'Delhi', state: 'DL', postal_code: '110002', slug: 'sunrise-heights-110002' }
]

function setupMocks() {
  vi.mocked(supabase.from).mockImplementation((table) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: table === 'owners' ? MOCK_SHOPS : MOCK_SOCIETIES,
        error: null
      }),
      then: vi.fn()
    }
    return chain
  })
}

function renderDirectory() {
  return render(<MemoryRouter><AdminDirectory /></MemoryRouter>)
}

beforeEach(() => setupMocks())
afterEach(() => vi.clearAllMocks())

describe('AdminDirectory — rendering', () => {
  it('shows the page heading', async () => {
    renderDirectory()
    await waitFor(() =>
      expect(screen.getByText(/shops & societies/i)).toBeInTheDocument()
    )
  })

  it('renders all shops including pending ones', async () => {
    renderDirectory()
    await waitFor(() => {
      expect(screen.getByText('Green Valley Prints')).toBeInTheDocument()
      expect(screen.getByText('Sunrise Prints')).toBeInTheDocument()
    })
  })

  it('shows all filter tabs including Pending', async () => {
    renderDirectory()
    await waitFor(() => {
      // Filter buttons include count e.g. "Pending (1)"
      expect(screen.getByRole('button', { name: /Pending/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Active/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^All/i })).toBeInTheDocument()
    })
  })

  it('shows society list', async () => {
    renderDirectory()
    await waitFor(() => {
      expect(screen.getByText('Green Valley')).toBeInTheDocument()
      expect(screen.getByText('Sunrise Heights')).toBeInTheDocument()
    })
  })
})

describe('AdminDirectory — filtering', () => {
  it('shows only pending shops when Pending filter is active', async () => {
    renderDirectory()
    await waitFor(() => screen.getByText('Green Valley Prints'))

    await userEvent.click(screen.getByRole('button', { name: /Pending/i }))
    await waitFor(() =>
      expect(screen.queryByText('Green Valley Prints')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Sunrise Prints')).toBeInTheDocument()
  })

  it('shows only active shops when Active filter is active', async () => {
    renderDirectory()
    await waitFor(() => screen.getByText('Green Valley Prints'))

    await userEvent.click(screen.getByRole('button', { name: /^Active/i }))
    await waitFor(() =>
      expect(screen.queryByText('Sunrise Prints')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Green Valley Prints')).toBeInTheDocument()
  })

  it('filters shops by search query', async () => {
    renderDirectory()
    await waitFor(() => screen.getByText('Green Valley Prints'))

    await userEvent.type(
      screen.getByPlaceholderText(/search by shop name/i),
      'Sunrise'
    )
    await waitFor(() =>
      expect(screen.queryByText('Green Valley Prints')).not.toBeInTheDocument()
    )
    expect(screen.getByText('Sunrise Prints')).toBeInTheDocument()
  })
})

describe('AdminDirectory — shop count', () => {
  it('shows total registered shops count', async () => {
    renderDirectory()
    await waitFor(() =>
      // Both "X registered" spans (shops + societies) should appear
      expect(screen.getAllByText(/\d+ registered/).length).toBeGreaterThanOrEqual(1)
    )
    // Shops: 2 registered (MOCK_SHOPS has 2 items)
    const counts = screen.getAllByText(/2 registered/)
    expect(counts.length).toBeGreaterThanOrEqual(1)
  })
})
