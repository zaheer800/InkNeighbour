import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PriceBreakdown from '../../components/PriceBreakdown'

describe('PriceBreakdown', () => {
  const defaultProps = {
    pages: 5,
    copies: 1,
    ratePerPage: 200, // ₹2 in paise
    deliveryFee: 800, // ₹8 in paise
    countryCode: 'IN'
  }

  it('renders without crashing when all props provided', () => {
    const { container } = render(<PriceBreakdown {...defaultProps} />)
    expect(container.firstChild).toBeTruthy()
  })

  it('returns null when pages is missing', () => {
    const { container } = render(
      <PriceBreakdown {...defaultProps} pages={0} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when copies is missing', () => {
    const { container } = render(
      <PriceBreakdown {...defaultProps} copies={0} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('returns null when ratePerPage is 0', () => {
    const { container } = render(
      <PriceBreakdown {...defaultProps} ratePerPage={0} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows total label', () => {
    render(<PriceBreakdown {...defaultProps} />)
    expect(screen.getByText('price.total')).toBeInTheDocument()
  })

  it('shows delivery fee row when fee > 0', () => {
    render(<PriceBreakdown {...defaultProps} />)
    expect(screen.getByText('price.delivery_fee')).toBeInTheDocument()
  })

  it('hides delivery fee row when fee = 0', () => {
    render(<PriceBreakdown {...defaultProps} deliveryFee={0} />)
    expect(screen.queryByText('price.delivery_fee')).not.toBeInTheDocument()
  })

  it('displays formatted currency amounts (contains digits)', () => {
    render(<PriceBreakdown {...defaultProps} />)
    // The total ₹18 (1800 paise) should appear somewhere
    expect(screen.getByText(/18/)).toBeInTheDocument()
  })

  it('shows page count and copies in the line item', () => {
    render(<PriceBreakdown {...defaultProps} />)
    expect(screen.getByText(/5/)).toBeInTheDocument() // 5 pages
  })
})
