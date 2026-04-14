import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from '../../../components/ui/Badge'

describe('Badge', () => {
  it('renders the mapped label for a known status', () => {
    render(<Badge status="submitted" />)
    expect(screen.getByText('Submitted')).toBeInTheDocument()
  })

  it('uses green variant for active/delivered statuses', () => {
    const { container } = render(<Badge status="active" />)
    expect(container.firstChild.className).toMatch(/text-green/)
  })

  it('uses amber variant for pending status', () => {
    const { container } = render(<Badge status="submitted" />)
    expect(container.firstChild.className).toMatch(/text-amber/)
  })

  it('uses red variant for cancelled status', () => {
    const { container } = render(<Badge status="cancelled" />)
    expect(container.firstChild.className).toMatch(/text-red/)
  })

  it('uses violet variant for printing status', () => {
    const { container } = render(<Badge status="printing" />)
    expect(container.firstChild.className).toMatch(/text-violet/)
  })

  it('uses green for delivered status', () => {
    const { container } = render(<Badge status="delivered" />)
    expect(container.firstChild.className).toMatch(/text-green/)
  })

  it('renders custom label when label prop is provided', () => {
    render(<Badge status="active" label="Open for business" />)
    expect(screen.getByText('Open for business')).toBeInTheDocument()
  })

  it('falls back to muted variant for unknown status', () => {
    const { container } = render(<Badge status="unknown_status" />)
    expect(container.firstChild.className).toMatch(/text-muted/)
  })

  it('uses status string as label for unknown status', () => {
    render(<Badge status="my_custom_status" />)
    expect(screen.getByText('my_custom_status')).toBeInTheDocument()
  })

  it('applies pill rounding class', () => {
    const { container } = render(<Badge status="active" />)
    expect(container.firstChild.className).toMatch(/rounded-pill/)
  })
})
