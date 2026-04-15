import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Input from '../../../components/ui/Input'

describe('Input', () => {
  it('renders input element', () => {
    render(<Input />)
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    render(<Input label="Full name" />)
    expect(screen.getByText('Full name')).toBeInTheDocument()
  })

  it('shows asterisk for required fields', () => {
    render(<Input label="Name" required />)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('does not show asterisk for optional fields', () => {
    render(<Input label="Name" />)
    expect(screen.queryByText('*')).not.toBeInTheDocument()
  })

  it('shows error message when error prop is provided', () => {
    render(<Input error="This field is required" />)
    expect(screen.getByText('This field is required')).toBeInTheDocument()
  })

  it('applies error styling when error prop is present', () => {
    render(<Input error="Error!" />)
    expect(screen.getByRole('textbox').className).toMatch(/border-red/)
  })

  it('shows hint text when provided and no error', () => {
    render(<Input hint="Enter your name" />)
    expect(screen.getByText('Enter your name')).toBeInTheDocument()
  })

  it('does not show hint when error is also provided', () => {
    render(<Input hint="Hint text" error="Error text" />)
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument()
  })

  it('forwards onChange handler', () => {
    const onChange = vi.fn()
    render(<Input onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hello' } })
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('forwards placeholder', () => {
    render(<Input placeholder="Type here" />)
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument()
  })

  it('passes through type prop', () => {
    render(<Input type="email" />)
    expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email')
  })

  it('meets minimum height requirement for elder-friendliness', () => {
    render(<Input />)
    expect(screen.getByRole('textbox').className).toMatch(/min-h-\[52px\]/)
  })
})
