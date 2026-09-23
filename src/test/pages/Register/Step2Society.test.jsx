import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Step2Society from '../../../pages/Register/Step2Society'
import { supabase } from '../../../lib/supabase'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const STEP1 = { name: 'Test Owner', phone: '9876543210', email: 'owner@test.com', password: 'pass123', country_code: 'IN' }

function renderStep2() {
  return render(<MemoryRouter><Step2Society /></MemoryRouter>)
}

describe('Step2Society — rendering', () => {
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks() })

  it('redirects to /register when step1 data is missing', async () => {
    renderStep2()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register'))
  })

  it('shows step 2 of 3 progress indicator', async () => {
    sessionStorage.setItem('reg_step1', JSON.stringify(STEP1))
    renderStep2()
    await waitFor(() =>
      expect(screen.getByText(/common\.step_of/)).toBeInTheDocument()
    )
  })

  it('renders the pincode input', async () => {
    sessionStorage.setItem('reg_step1', JSON.stringify(STEP1))
    renderStep2()
    await waitFor(() =>
      expect(screen.getByPlaceholderText('register.postal_code_placeholder')).toBeInTheDocument()
    )
  })
})

describe('Step2Society — postal code validation', () => {
  beforeEach(() => sessionStorage.setItem('reg_step1', JSON.stringify(STEP1)))
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks() })

  it('does NOT show SocietySearch for a short postal code', async () => {
    renderStep2()
    await waitFor(() => screen.getByPlaceholderText('register.postal_code_placeholder'))
    await userEvent.type(screen.getByPlaceholderText('register.postal_code_placeholder'), '110')
    expect(screen.queryByText(/register\.search_societies/i)).not.toBeInTheDocument()
  })

  it('shows SocietySearch once postal code reaches 5 characters', async () => {
    renderStep2()
    await waitFor(() => screen.getByPlaceholderText('register.postal_code_placeholder'))
    await userEvent.type(screen.getByPlaceholderText('register.postal_code_placeholder'), '11000')
    await waitFor(() =>
      expect(screen.getByText('register.search_societies')).toBeInTheDocument()
    )
  })
})

describe('Step2Society — society selection', () => {
  beforeEach(() => {
    sessionStorage.setItem('reg_step1', JSON.stringify(STEP1))
    const societies = [
      { id: 'soc-1', name: 'Green Valley', slug: 'green-valley-110001', city: 'Delhi', state: 'DL', is_taken: false, owner_name: null }
    ]
    vi.mocked(supabase.rpc).mockResolvedValue({ data: societies, error: null })
    // Step2Society geocodes the postal code via a real fetch() to Nominatim on selection —
    // stub it so tests don't make a network call.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve([]) }))
  })
  afterEach(() => { sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals() })

  it('writes reg_step2 to sessionStorage and navigates to /register/rates on selection', async () => {
    renderStep2()
    await waitFor(() => screen.getByPlaceholderText('register.postal_code_placeholder'))
    await userEvent.type(screen.getByPlaceholderText('register.postal_code_placeholder'), '110001')

    await waitFor(() => screen.getByText('register.search_societies'))
    await userEvent.click(screen.getByText('register.search_societies'))

    await waitFor(() => screen.getByText('Green Valley'))
    await userEvent.click(screen.getByText('Green Valley'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/rates'))
    const stored = JSON.parse(sessionStorage.getItem('reg_step2'))
    expect(stored.postalCode).toBe('110001')
    expect(stored.isNew).toBe(false)
  })
})
