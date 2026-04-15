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
  it('renders the tagline', () => {
    renderLanding()
    expect(screen.getByText('landing.hero_title')).toBeInTheDocument()
  })

  it('renders the hero subtitle', () => {
    renderLanding()
    expect(screen.getByText('landing.hero_sub')).toBeInTheDocument()
  })

  it('renders the pincode input', () => {
    renderLanding()
    expect(screen.getByPlaceholderText('landing.pincode_placeholder')).toBeInTheDocument()
  })

  it('renders the Find a Printer button', () => {
    renderLanding()
    expect(screen.getByRole('button', { name: /landing\.cta_find/i })).toBeInTheDocument()
  })

  it('Find a Printer button is disabled when pincode is empty', () => {
    renderLanding()
    expect(screen.getByRole('button', { name: /landing\.cta_find/i })).toBeDisabled()
  })

  it('navigates to /find with pincode on form submit', () => {
    renderLanding()
    const input = screen.getByPlaceholderText('landing.pincode_placeholder')
    fireEvent.change(input, { target: { value: '400001' } })
    fireEvent.submit(input.closest('form'))
    expect(mockNavigate).toHaveBeenCalledWith('/find?pincode=400001')
  })

  it('renders the Register CTA link', () => {
    renderLanding()
    expect(screen.getByText('landing.cta_register')).toBeInTheDocument()
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

  it('renders the footer', () => {
    renderLanding()
    expect(screen.getByText(/InkNeighbour/)).toBeInTheDocument()
  })

  it('renders the app name in the navbar', () => {
    renderLanding()
    // InkNeighbour is split between Ink and Neighbour text nodes
    expect(screen.getAllByText(/InkNeighbour|Ink|Neighbour/i).length).toBeGreaterThan(0)
  })
})
