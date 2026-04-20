import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SocietySearch from '../../components/SocietySearch'
import { supabase } from '../../lib/supabase'

const mockOnSelect = vi.fn()

function mockSocieties(list) {
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    then: (resolve) => Promise.resolve({ data: list, error: null }).then(resolve),
  }
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  vi.mocked(supabase.from).mockReturnValue(chain)
}

function renderSearch(props = {}) {
  return render(
    <SocietySearch postalCode="110001" countryCode="IN" onSelect={mockOnSelect} {...props} />
  )
}

afterEach(() => vi.clearAllMocks())

describe('SocietySearch — initial state', () => {
  it('shows a Search button before any search is performed', () => {
    renderSearch()
    expect(screen.getByText('register.search_societies')).toBeInTheDocument()
  })

  it('does not show societies list before search', () => {
    renderSearch()
    expect(screen.queryByText('register.known_societies')).not.toBeInTheDocument()
  })
})

describe('SocietySearch — after search with results', () => {
  beforeEach(() => {
    mockSocieties([
      { id: 's-1', name: 'Green Valley', slug: 'green-valley', city: 'Delhi', state: 'DL', owners: [] },
      { id: 's-2', name: 'Sunrise Heights', slug: 'sunrise-heights', city: 'Delhi', state: 'DL',
        owners: [{ id: 'o-1', name: 'Amir Khan', status: 'active' }] }
    ])
  })

  it('displays society names after clicking Search', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => {
      expect(screen.getByText('Green Valley')).toBeInTheDocument()
      expect(screen.getByText('Sunrise Heights')).toBeInTheDocument()
    })
  })

  it('marks available societies with register.available label', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => expect(screen.getByText('register.available')).toBeInTheDocument())
  })

  it('marks taken societies with register.taken label', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => expect(screen.getByText('register.taken')).toBeInTheDocument())
  })

  it('calls onSelect with { society, isNew: false } when available society is clicked', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => screen.getByText('Green Valley'))
    await userEvent.click(screen.getByText('Green Valley'))
    expect(mockOnSelect).toHaveBeenCalledWith({
      society: expect.objectContaining({ id: 's-1', name: 'Green Valley' }),
      isNew: false
    })
  })

  it('shows + add my society button after search', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() =>
      expect(screen.getByText(/register\.add_my_society/)).toBeInTheDocument()
    )
  })
})

describe('SocietySearch — empty search results', () => {
  beforeEach(() => mockSocieties([]))

  it('shows manual entry option when no societies are found', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() =>
      expect(screen.getByText(/register\.add_my_society/)).toBeInTheDocument()
    )
  })
})

describe('SocietySearch — manual entry flow', () => {
  beforeEach(() => mockSocieties([]))

  it('shows manual name input after clicking add my society', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => screen.getByText(/register\.add_my_society/))
    await userEvent.click(screen.getByText(/register\.add_my_society/))
    expect(screen.getByText('register.society_name')).toBeInTheDocument()
  })

  it('calls onSelect with isNew: true when manual name is confirmed', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => screen.getByText(/register\.add_my_society/))
    await userEvent.click(screen.getByText(/register\.add_my_society/))

    await userEvent.type(
      screen.getByPlaceholderText('register.society_name_placeholder'),
      'My New Colony'
    )
    await userEvent.click(screen.getByText('register.confirm_society'))

    expect(mockOnSelect).toHaveBeenCalledWith({
      society: expect.objectContaining({ name: 'My New Colony', postal_code: '110001' }),
      isNew: true
    })
  })
})

describe('SocietySearch — fuzzy duplicate warning', () => {
  beforeEach(() => {
    mockSocieties([
      { id: 's-1', name: 'Sunshine Apartments', slug: 'sunshine-apartments', city: 'Delhi', state: 'DL', owners: [] }
    ])
  })

  it('shows a warning when typed name closely matches an existing society', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => screen.getByText(/register\.add_my_society/))
    await userEvent.click(screen.getByText(/register\.add_my_society/))

    // 'Sunshinee Apartments' is a near-typo of 'Sunshine Apartments'
    await userEvent.type(
      screen.getByPlaceholderText('register.society_name_placeholder'),
      'Sunshinee Apartments'
    )
    await waitFor(() =>
      expect(screen.getByText(/register\.similar_exists/)).toBeInTheDocument()
    )
  })

  it('allows override after confirming the society is different', async () => {
    renderSearch()
    await userEvent.click(screen.getByText('register.search_societies'))
    await waitFor(() => screen.getByText(/register\.add_my_society/))
    await userEvent.click(screen.getByText(/register\.add_my_society/))

    await userEvent.type(
      screen.getByPlaceholderText('register.society_name_placeholder'),
      'Sunshinee Apartments'
    )
    await waitFor(() => screen.getByText('register.yes_different'))

    // First click confirms the override, second submits
    await userEvent.click(screen.getByText('register.yes_different'))
    await userEvent.click(screen.getByText('register.confirm_society'))
    expect(mockOnSelect).toHaveBeenCalledWith(expect.objectContaining({ isNew: true }))
  })
})
