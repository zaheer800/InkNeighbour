import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Step1Details from '../../../pages/Register/Step1Details'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderStep1() {
  return render(<MemoryRouter><Step1Details /></MemoryRouter>)
}

describe('Step1Details — rendering', () => {
  it('shows step 1 of 3 progress indicator', () => {
    renderStep1()
    expect(screen.getByText(/common\.step_of/)).toBeInTheDocument()
  })

  it('renders all required inputs', () => {
    renderStep1()
    expect(screen.getByLabelText(/register\.name_label/)).toBeInTheDocument()
    expect(screen.getByLabelText(/register\.phone_label/)).toBeInTheDocument()
    expect(screen.getByLabelText(/register\.email_label/)).toBeInTheDocument()
    expect(screen.getByLabelText(/register\.password_label/)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders a Next button', () => {
    renderStep1()
    expect(screen.getByRole('button', { name: /common\.next/i })).toBeInTheDocument()
  })
})

describe('Step1Details — validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows required errors when form is empty', async () => {
    renderStep1()
    await userEvent.click(screen.getByRole('button', { name: /common\.next/i }))
    const errors = await screen.findAllByText('register.validation_required')
    expect(errors.length).toBeGreaterThanOrEqual(3)
  })

  it('shows phone format error for non-Indian mobile format', async () => {
    renderStep1()
    await userEvent.type(screen.getByLabelText(/register\.name_label/), 'Test Owner')
    await userEvent.type(screen.getByLabelText(/register\.phone_label/), '1234567890') // starts with 1, not 6-9
    await userEvent.type(screen.getByLabelText(/register\.email_label/), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/register\.password_label/), 'pass123')
    await userEvent.click(screen.getByRole('button', { name: /common\.next/i }))
    expect(await screen.findByText('register.validation_phone')).toBeInTheDocument()
  })

  it('shows email format error for malformed email', async () => {
    renderStep1()
    await userEvent.type(screen.getByLabelText(/register\.name_label/), 'Test Owner')
    await userEvent.type(screen.getByLabelText(/register\.phone_label/), '9876543210')
    await userEvent.type(screen.getByLabelText(/register\.email_label/), 'notanemail')
    await userEvent.type(screen.getByLabelText(/register\.password_label/), 'pass123')
    await userEvent.click(screen.getByRole('button', { name: /common\.next/i }))
    expect(await screen.findByText('register.validation_email')).toBeInTheDocument()
  })

  it('shows password error when password is fewer than 6 characters', async () => {
    renderStep1()
    await userEvent.type(screen.getByLabelText(/register\.name_label/), 'Test Owner')
    await userEvent.type(screen.getByLabelText(/register\.phone_label/), '9876543210')
    await userEvent.type(screen.getByLabelText(/register\.email_label/), 'a@b.com')
    await userEvent.type(screen.getByLabelText(/register\.password_label/), 'abc')
    await userEvent.click(screen.getByRole('button', { name: /common\.next/i }))
    expect(await screen.findByText(/at least 6 characters/i)).toBeInTheDocument()
  })
})

describe('Step1Details — successful submit', () => {
  afterEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  it('writes form data to sessionStorage.reg_step1 and navigates to /register/society', async () => {
    renderStep1()
    await userEvent.type(screen.getByLabelText(/register\.name_label/), 'Zaheer Ahmed')
    await userEvent.type(screen.getByLabelText(/register\.phone_label/), '9876543210')
    await userEvent.type(screen.getByLabelText(/register\.email_label/), 'zaheer@test.com')
    await userEvent.type(screen.getByLabelText(/register\.password_label/), 'securepass')
    await userEvent.click(screen.getByRole('button', { name: /common\.next/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/society'))

    const stored = JSON.parse(sessionStorage.getItem('reg_step1'))
    expect(stored).toMatchObject({
      name: 'Zaheer Ahmed',
      phone: '9876543210',
      email: 'zaheer@test.com',
      password: 'securepass',
      country_code: 'IN'
    })
  })

  it('accepts a valid 10-digit mobile number starting with 9', async () => {
    renderStep1()
    await userEvent.type(screen.getByLabelText(/register\.name_label/), 'Test')
    await userEvent.type(screen.getByLabelText(/register\.phone_label/), '9999999999')
    await userEvent.type(screen.getByLabelText(/register\.email_label/), 'x@y.com')
    await userEvent.type(screen.getByLabelText(/register\.password_label/), '123456')
    await userEvent.click(screen.getByRole('button', { name: /common\.next/i }))

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/register/society'))
    expect(screen.queryByText('register.validation_phone')).not.toBeInTheDocument()
  })
})
