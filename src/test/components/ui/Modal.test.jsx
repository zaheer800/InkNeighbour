import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Modal from '../../../components/ui/Modal'

describe('Modal', () => {
  it('renders nothing when open=false', () => {
    render(<Modal open={false} onClose={vi.fn()} title="Test"><p>Content</p></Modal>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('renders content when open=true', () => {
    render(<Modal open={true} onClose={vi.fn()} title="Test"><p>Modal content</p></Modal>)
    expect(screen.getByText('Modal content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    render(<Modal open={true} onClose={vi.fn()} title="Confirm Action"><p>Body</p></Modal>)
    expect(screen.getByText('Confirm Action')).toBeInTheDocument()
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    // The backdrop is the first child div of the dialog
    const backdrop = container.querySelector('.absolute.inset-0')
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose for non-Escape keys', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="Test"><p>Body</p></Modal>)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has correct aria-modal attribute', () => {
    render(<Modal open={true} onClose={vi.fn()} title="Test"><p>Body</p></Modal>)
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })
})
