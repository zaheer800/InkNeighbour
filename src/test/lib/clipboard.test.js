import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyToClipboard } from '../../lib/clipboard'

describe('copyToClipboard', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

  it('uses navigator.clipboard.writeText when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    await copyToClipboard('hello')
    expect(writeText).toHaveBeenCalledWith('hello')
  })

  it('falls back to a hidden textarea + execCommand when clipboard API is unavailable', async () => {
    vi.stubGlobal('navigator', {})
    const execCommand = vi.fn()
    document.execCommand = execCommand

    await copyToClipboard('fallback text')
    expect(execCommand).toHaveBeenCalledWith('copy')
  })
})
