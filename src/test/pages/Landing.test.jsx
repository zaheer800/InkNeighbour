import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Landing from '../../pages/Landing'

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
  it('renders the hero tagline', () => {
    renderLanding()
    // "Print it." appears in multiple tagline elements — getAllByText is appropriate
    const matches = screen.getAllByText(/Print it\./i)
    expect(matches.length).toBeGreaterThan(0)
  })

  it('renders the hero subtitle', () => {
    renderLanding()
    expect(screen.getByText(/Find a home printer in your building/i)).toBeInTheDocument()
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
    // Both nav and owner CTA section have links to /register
    const registerLinks = screen.getAllByRole('link', { name: /register/i })
    expect(registerLinks.length).toBeGreaterThan(0)
  })

  it('renders the How it Works section', () => {
    renderLanding()
    expect(screen.getByText('landing.how_title')).toBeInTheDocument()
  })

  it('renders 3 how-it-works steps', () => {
    renderLanding()
    expect(screen.getByText('landing.step1_title')).toBeInTheDocument()
    expect(screen.getByText('landing.step2_title')).toBeInTheDocument()
    expect(screen.getByText('landing.step3_title')).toBeInTheDocument()
  })

  it('renders the owner CTA section', () => {
    renderLanding()
    expect(screen.getByText('landing.owners_title')).toBeInTheDocument()
  })

  it('renders the footer with current year', () => {
    renderLanding()
    expect(screen.getByText(new RegExp(new Date().getFullYear()))).toBeInTheDocument()
  })

  it('renders Privacy Policy link in footer', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: /privacy policy/i })).toBeInTheDocument()
  })

  it('renders Terms of Service link in footer', () => {
    renderLanding()
    expect(screen.getByRole('link', { name: /terms of service/i })).toBeInTheDocument()
  })
})
