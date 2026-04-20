import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Success from '../../../pages/Register/Success'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderSuccess() {
  return render(<MemoryRouter><Success /></MemoryRouter>)
}

afterEach(() => { sessionStorage.clear(); vi.clearAllMocks() })

describe('Success — redirect guard', () => {
  it('redirects to /register when reg_success is missing', async () => {
    renderSuccess()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register'))
  })

  it('renders nothing until data resolves', () => {
    const { container } = renderSuccess()
    expect(container.firstChild).toBeNull()
  })
})

describe('Success — email verification path (pendingEmail present)', () => {
  beforeEach(() => {
    sessionStorage.setItem('reg_success', JSON.stringify({
      ownerName: 'Zaheer Ahmed',
      pendingEmail: 'zaheer@test.com'
    }))
  })

  it('shows "Check your email" heading', async () => {
    renderSuccess()
    await waitFor(() =>
      expect(screen.getByText(/check your email/i)).toBeInTheDocument()
    )
  })

  it('displays the pending email address', async () => {
    renderSuccess()
    await waitFor(() =>
      expect(screen.getByText('zaheer@test.com')).toBeInTheDocument()
    )
  })

  it('does NOT show "Go to Dashboard" button', async () => {
    renderSuccess()
    await waitFor(() => screen.getByText(/check your email/i))
    expect(screen.queryByText(/go.*dashboard/i)).not.toBeInTheDocument()
  })

  it('shows a "start again" link back to /register', async () => {
    renderSuccess()
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /start again/i })
      expect(link).toBeInTheDocument()
    })
  })
})

describe('Success — shop submitted path (no pendingEmail)', () => {
  beforeEach(() => {
    sessionStorage.setItem('reg_success', JSON.stringify({
      ownerName: 'Zaheer Ahmed'
    }))
  })

  it('shows "Shop submitted!" heading', async () => {
    renderSuccess()
    await waitFor(() =>
      expect(screen.getByText(/shop submitted/i)).toBeInTheDocument()
    )
  })

  it('shows the "Go to Dashboard" button', async () => {
    renderSuccess()
    await waitFor(() =>
      expect(screen.getByText('success.go_dashboard')).toBeInTheDocument()
    )
  })

  it('does NOT show "Check your email" heading', async () => {
    renderSuccess()
    await waitFor(() => screen.getByText(/shop submitted/i))
    expect(screen.queryByText(/check your email/i)).not.toBeInTheDocument()
  })
})
