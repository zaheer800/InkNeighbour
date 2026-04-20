import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Step3Rates from '../../../pages/Register/Step3Rates'
import { supabase } from '../../../lib/supabase'
import { toast } from 'sonner'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

// Supabase query builder that works both as chainable AND as a direct await.
// Chainable: .insert().select().single() → resolves via single()
// Direct:    await .insert()             → resolves via .then()
function makeChain(data = null, error = null) {
  const chain = {
    data,
    error,
    then: (resolve) => Promise.resolve({ data, error }).then(resolve),
    select: vi.fn(),
    eq:     vi.fn(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    insert: vi.fn(),
    update: vi.fn(),
    not:    vi.fn(),
  }
  // All chainable methods return the same chain object
  chain.select.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.not.mockReturnValue(chain)
  chain.insert.mockReturnValue(chain)
  chain.update.mockReturnValue(chain)
  return chain
}

// Session storage seeds
const STEP1 = {
  name: 'Test Owner', phone: '9876543210',
  email: 'owner@test.com', password: 'pass123', country_code: 'IN'
}
const STEP2_EXISTING = {
  society: { id: 'soc-uuid-1', name: 'Green Valley', slug: 'green-valley-110001' },
  isNew: false, postalCode: '110001'
}
const STEP2_NEW = {
  society: { name: 'Sunrise Heights', postal_code: '110002', country_code: 'IN' },
  isNew: true, postalCode: '110002'
}

function seedSession(step2 = STEP2_EXISTING) {
  sessionStorage.setItem('reg_step1', JSON.stringify(STEP1))
  sessionStorage.setItem('reg_step2', JSON.stringify(step2))
}

function renderStep3() {
  return render(<MemoryRouter><Step3Rates /></MemoryRouter>)
}

describe('Step3Rates — rendering', () => {
  beforeEach(() => seedSession())
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks() })

  it('redirects to /register when session storage is empty', async () => {
    sessionStorage.clear()
    renderStep3()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register'))
  })

  it('pre-fills shop name from society name', async () => {
    renderStep3()
    await waitFor(() => {
      const input = screen.getByDisplayValue(/Green Valley Print Shop/i)
      expect(input).toBeInTheDocument()
    })
  })

  it('shows step 3 of 3 progress indicator', async () => {
    renderStep3()
    await waitFor(() => expect(screen.getByText(/common\.step_of/)).toBeInTheDocument())
  })
})

describe('Step3Rates — validation', () => {
  beforeEach(() => seedSession())
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks() })

  it('shows error when B&W rate is cleared', async () => {
    renderStep3()
    await waitFor(() => screen.getByDisplayValue('2'))

    const bwInput = screen.getByDisplayValue('2')
    await userEvent.clear(bwInput)
    await userEvent.click(screen.getByText('register.launch_cta'))
    expect(await screen.findByText(/valid B&W rate/i)).toBeInTheDocument()
  })

  it('shows error when colour rate is zero or invalid', async () => {
    renderStep3()
    await waitFor(() => screen.getByDisplayValue('5'))

    const colInput = screen.getByDisplayValue('5')
    await userEvent.clear(colInput)
    await userEvent.type(colInput, '0')
    await userEvent.click(screen.getByText('register.launch_cta'))
    expect(await screen.findByText(/valid colour rate/i)).toBeInTheDocument()
  })
})

describe('Step3Rates — Path A: email confirmation enabled', () => {
  beforeEach(() => {
    seedSession()
    // signUp returns no session → email confirmation required
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: { id: 'uid-1' }, session: null },
      error: null
    })
    vi.mocked(supabase.from).mockReturnValue(makeChain())
  })
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks() })

  it('stores ownerPayload in localStorage and navigates to /register/success', async () => {
    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))

    await userEvent.click(screen.getByText('register.launch_cta'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/success'))

    const stored = JSON.parse(localStorage.getItem('reg_pending'))
    expect(stored).toMatchObject({
      isNewSociety:      false,
      societyId:         'soc-uuid-1',
      societyName:       null,
      societyPostalCode: null,
      name:         'Test Owner',
      phone:        '9876543210',
      country_code: 'IN',
      bw_rate:      200,
      color_rate:   500,
      delivery_fee: 800,
      accept_cash:  true
    })
  })

  it('writes reg_success to sessionStorage with pendingEmail', async () => {
    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/success'))

    const success = JSON.parse(sessionStorage.getItem('reg_success'))
    expect(success.pendingEmail).toBe('owner@test.com')
    expect(success.ownerName).toBe('Test Owner')
  })

  it('does NOT call supabase.from for societies or owners — all DB deferred', async () => {
    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/success'))

    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('stores society details (not ID) when society is new', async () => {
    sessionStorage.setItem('reg_step2', JSON.stringify(STEP2_NEW))
    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/success'))

    const stored = JSON.parse(localStorage.getItem('reg_pending'))
    expect(stored.isNewSociety).toBe(true)
    expect(stored.societyName).toBe('Sunrise Heights')
    expect(stored.societyPostalCode).toBe('110002')
    expect(stored.societyId).toBeNull()
    // No DB writes
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('Step3Rates — Path B: no email confirmation (session present)', () => {
  beforeEach(() => {
    seedSession()
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: { user: { id: 'uid-1' }, session: { access_token: 'tok' } },
      error: null
    })
  })
  afterEach(() => { sessionStorage.clear(); localStorage.clear(); vi.clearAllMocks() })

  it('creates owner in DB and navigates to /register/success (existing society)', async () => {
    // owners.maybeSingle() → no existing owner
    // owners.insert() → success
    const ownersChain = makeChain()
    ownersChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    vi.mocked(supabase.from).mockReturnValue(ownersChain)

    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/success'))
    expect(localStorage.getItem('reg_pending')).toBeNull()
  })

  it('creates society then owner when isNew is true', async () => {
    sessionStorage.setItem('reg_step2', JSON.stringify(STEP2_NEW))

    const societiesChain = makeChain({ id: 'new-soc-id' })
    const ownersChain = makeChain()
    ownersChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'societies') return societiesChain
      return ownersChain
    })

    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/success'))
    // societies.insert was called
    expect(vi.mocked(supabase.from)).toHaveBeenCalledWith('societies')
  })

  it('shows society-taken error when owner insert returns 23505', async () => {
    const ownersChain = makeChain(null, { code: '23505', message: 'unique constraint' })
    ownersChain.maybeSingle.mockResolvedValue({ data: null, error: null })

    vi.mocked(supabase.from).mockReturnValue(ownersChain)

    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/already has a registered printer owner/i)
      )
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/register/success')
  })

  it('shows error when user already has a shop registered', async () => {
    const ownersChain = makeChain({ id: 'existing-owner-id' }) // existing owner found
    ownersChain.maybeSingle.mockResolvedValue({ data: { id: 'existing-owner-id' }, error: null })

    vi.mocked(supabase.from).mockReturnValue(ownersChain)

    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        expect.stringMatching(/already have a shop registered/i)
      )
    })
  })

  it('shows error when signUp fails', async () => {
    // Reset queue from beforeEach so only this mock is used
    vi.mocked(supabase.auth.signUp).mockReset()
    vi.mocked(supabase.auth.signUp).mockResolvedValueOnce({
      data: null,
      error: { message: 'Email already registered' }
    })

    renderStep3()
    await waitFor(() => screen.getByText('register.launch_cta'))
    await userEvent.click(screen.getByText('register.launch_cta'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Email already registered')
    })
  })
})
