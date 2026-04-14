import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StarRating, { StarDisplay } from '../../components/StarRating'

describe('StarRating — interactive', () => {
  it('renders 5 star buttons', () => {
    render(<StarRating value={0} onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(5)
  })

  it('calls onChange with clicked star number', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[2]) // 3rd star
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('calls onChange with 1 for first star', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('calls onChange with 5 for last star', () => {
    const onChange = vi.fn()
    render(<StarRating value={0} onChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[4])
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('has aria-labels for accessibility', () => {
    render(<StarRating value={3} onChange={vi.fn()} />)
    expect(screen.getByLabelText('1 star')).toBeInTheDocument()
    expect(screen.getByLabelText('3 stars')).toBeInTheDocument()
    expect(screen.getByLabelText('5 stars')).toBeInTheDocument()
  })
})

describe('StarRating — readOnly', () => {
  it('renders 5 disabled buttons in readOnly mode', () => {
    render(<StarRating value={4} readOnly />)
    screen.getAllByRole('button').forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('does not call onChange in readOnly mode', () => {
    const onChange = vi.fn()
    render(<StarRating value={3} readOnly onChange={onChange} />)
    fireEvent.click(screen.getAllByRole('button')[0])
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('StarDisplay', () => {
  it('renders rating and count when count >= 3', () => {
    render(<StarDisplay rating={4.8} count={24} />)
    expect(screen.getByText(/4\.8/)).toBeInTheDocument()
    expect(screen.getByText(/24 ratings/)).toBeInTheDocument()
  })

  it('returns null when count < 3', () => {
    const { container } = render(<StarDisplay rating={5} count={2} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when count is 0', () => {
    const { container } = render(<StarDisplay rating={4} count={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('returns null when rating is undefined', () => {
    const { container } = render(<StarDisplay count={5} />)
    expect(container.firstChild).toBeNull()
  })
})
