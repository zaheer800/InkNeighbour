import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import FeedbackForm from '../../pages/FeedbackForm'
import { supabase } from '../../lib/supabase'

// Use actual react-router for this test — we need useParams to work
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual }
})

const DELIVERED_JOB = {
  id: 'job-uuid-123',
  job_number: 'INK-0042',
  status: 'delivered',
  updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
  owners: {
    id: 'owner-uuid',
    name: 'Zaheer Khan',
    societies: { name: 'Sunshine Apartments' }
  }
}

function renderFeedbackForm(jobId = 'job-uuid-123') {
  return render(
    <MemoryRouter initialEntries={[`/feedback/${jobId}`]}>
      <Routes>
        <Route path="/feedback/:jobId" element={<FeedbackForm />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('FeedbackForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    // Mock a slow response
    supabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnValue(new Promise(() => {})) // never resolves
    })
    renderFeedbackForm()
    expect(screen.getByText('common.loading')).toBeInTheDocument()
  })

  it('shows expired message for a job delivered > 7 days ago', async () => {
    const expiredJob = {
      ...DELIVERED_JOB,
      updated_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    }

    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: expiredJob, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })

    renderFeedbackForm()
    expect(await screen.findByText('feedback_form.expired_title')).toBeInTheDocument()
  })

  it('shows already submitted message when feedback exists', async () => {
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: DELIVERED_JOB, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-feedback' }, error: null })
      })

    renderFeedbackForm()
    expect(await screen.findByText('feedback_form.already_submitted')).toBeInTheDocument()
  })

  it('renders the feedback form for a valid recent job', async () => {
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: DELIVERED_JOB, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })

    renderFeedbackForm()
    expect(await screen.findByText('feedback_form.title')).toBeInTheDocument()
  })

  it('renders the two thumb questions', async () => {
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: DELIVERED_JOB, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })

    renderFeedbackForm()
    await screen.findByText('feedback_form.q1')
    expect(screen.getByText('feedback_form.q1')).toBeInTheDocument()
    expect(screen.getByText('feedback_form.q2')).toBeInTheDocument()
  })

  it('shows star rating required error when submitting without stars', async () => {
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: DELIVERED_JOB, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })

    renderFeedbackForm()
    await screen.findByText('feedback_form.submit')
    fireEvent.click(screen.getByText('feedback_form.submit'))
    expect(await screen.findByText('feedback_form.star_required')).toBeInTheDocument()
  })

  it('shows thank-you message after successful submission', async () => {
    supabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: DELIVERED_JOB, error: null })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      })
      // feedback insert
      .mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ data: {}, error: null })
      })
      // job status update
      .mockReturnValueOnce({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: {}, error: null })
      })

    renderFeedbackForm()
    await screen.findByText('feedback_form.title')

    // Select 4 stars
    const starButtons = screen.getAllByRole('button', { name: /star/i })
    fireEvent.click(starButtons[3]) // 4th star

    fireEvent.click(screen.getByText('feedback_form.submit'))
    expect(await screen.findByText('feedback_form.success_title')).toBeInTheDocument()
  })
})
