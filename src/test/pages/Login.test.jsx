import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../pages/Login'
import { supabase } from '../../lib/supabase'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderLogin() {
  return render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>
  )
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the login heading', () => {
    renderLogin()
    expect(screen.getByText('login.title')).toBeInTheDocument()
  })

  it('renders email and password inputs', () => {
    renderLogin()
    expect(screen.getByLabelText(/login\.email_label/)).toBeInTheDocument()
    expect(screen.getByLabelText(/login\.password_label/)).toBeInTheDocument()
  })

  it('renders the sign-in button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: /login\.cta/i })).toBeInTheDocument()
  })

  it('renders the register link', () => {
    renderLogin()
    expect(screen.getByText('login.register_link')).toBeInTheDocument()
  })

  it('shows loading state when signing in', async () => {
    // Delay the sign-in response
    supabase.auth.signInWithPassword.mockResolvedValueOnce(
      new Promise(resolve => setTimeout(() => resolve({ data: {}, error: null }), 100))
    )
    renderLogin()
    const emailInput = screen.getByLabelText(/login\.email_label/)
    const passwordInput = screen.getByLabelText(/login\.password_label/)
    await userEvent.type(emailInput, 'test@example.com')
    await userEvent.type(passwordInput, 'password123')
    fireEvent.submit(emailInput.closest('form'))
    expect(await screen.findByText('login.signing_in')).toBeInTheDocument()
  })

  it('shows error message on invalid credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login credentials' }
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/login\.email_label/), 'bad@example.com')
    await userEvent.type(screen.getByLabelText(/login\.password_label/), 'wrongpass')
    fireEvent.submit(screen.getByLabelText(/login\.email_label/).closest('form'))
    expect(await screen.findByText('login.error_invalid')).toBeInTheDocument()
  })

  it('navigates to /dashboard on successful sign-in', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'uid-1' }, session: {} },
      error: null
    })
    renderLogin()
    await userEvent.type(screen.getByLabelText(/login\.email_label/), 'owner@example.com')
    await userEvent.type(screen.getByLabelText(/login\.password_label/), 'correctpass')
    fireEvent.submit(screen.getByLabelText(/login\.email_label/).closest('form'))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })
})
