import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../../pages/Landing'
import { supabase } from '../../lib/supabase'

// useNavigate is mocked in setup.js; override here to capture calls
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLanding() {
  return render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>
  )
}

describe('Landing page', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('shows My Dashboard instead of Owner Login when signed in', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } })
    renderLanding()
    expect(await screen.findByText('My Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Owner Login')).not.toBeInTheDocument()
  })

  it('opens the dashboard straight away when launched as the installed app', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } })
    const orig = window.matchMedia
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addListener: vi.fn(), removeListener: vi.fn() })
    mockNavigate.mockClear()
    renderLanding()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }))
    window.matchMedia = orig
  })

  it('renders the hero tagline', () => {
    renderLanding()
    // "Print it." appears in multiple tagline elements — getAllByText is appropriate
    const matches = screen.getAllByText(/Print it\./i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders the hero subtitle', () => {
    renderLanding()
    expect(screen.getByText(/Browse home printer owners and local print shops near you/i)).toBeInTheDocument()
  })

  it('renders the pincode input', () => {
    renderLanding()
    expect(screen.getByPlaceholderText(/Enter your pincode/i)).toBeInTheDocument()
  })

  it('renders the Find button', () => {
    renderLanding()
    expect(screen.getByRole('button', { name: /find printer/i })).toBeInTheDocument()
  })

  it('does not navigate when pincode is empty and form is submitted', () => {
    renderLanding()
    const input = screen.getByPlaceholderText(/Enter your pincode/i)
    fireEvent.submit(input.closest('form'))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates to /find with pincode on form submit', () => {
    renderLanding()
    const input = screen.getByPlaceholderText(/Enter your pincode/i)
    fireEvent.change(input, { target: { value: '400001' } })
    fireEvent.submit(input.closest('form'))
    expect(mockNavigate).toHaveBeenCalledWith('/find?pincode=400001')
  })

  it('renders a link to /register', () => {
    renderLanding()
    // The provider CTA cards link to /register
    const registerLinks = screen.getAllByRole('link').filter(l => l.getAttribute('href') === '/register')
    expect(registerLinks.length).toBeGreaterThan(0)
  })

  it('renders the How it Works section', () => {
    renderLanding()
    expect(screen.getByText(/how it works/i)).toBeInTheDocument()
  })

  it('renders 3 how-it-works steps', () => {
    renderLanding()
    expect(screen.getByText('Find')).toBeInTheDocument()
    expect(screen.getByText('Upload')).toBeInTheDocument()
    expect(screen.getByText('Receive')).toBeInTheDocument()
  })

  it('renders the owner CTA section', () => {
    renderLanding()
    expect(screen.getByText(/for providers/i)).toBeInTheDocument()
  })

  it('renders the footer with current year', () => {
    renderLanding()
    expect(screen.getByText(new RegExp(new Date().getFullYear()))).toBeInTheDocument()
  })

  it('renders Privacy Policy link in footer', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: /privacy/i })).toBeInTheDocument()
  })

  it('renders Terms of Service link in footer', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: /terms/i })).toBeInTheDocument()
  })
})
