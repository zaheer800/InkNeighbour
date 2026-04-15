import { describe, it, expect } from 'vitest'
import { buildWhatsAppLink, buildShopShareLink } from '../../notifications/whatsapp'

const JOB = {
  jobNumber: 'INK-0042',
  customerName: 'Priya Sharma',
  customerFlat: 'A-204',
  pageCount: 5,
  printType: 'bw',
  copies: 1,
  amount: 1800
}

describe('buildWhatsAppLink', () => {
  it('builds a wa.me URL', () => {
    const link = buildWhatsAppLink('9876543210', JOB)
    expect(link).toMatch(/^https:\/\/wa\.me\//)
  })

  it('includes the phone number without formatting', () => {
    const link = buildWhatsAppLink('+91 98765 43210', JOB)
    // Phone should be normalised (no +, spaces, dashes)
    expect(link).toContain('wa.me/919876543210')
  })

  it('includes job number in the encoded message', () => {
    const link = buildWhatsAppLink('9876543210', JOB)
    expect(decodeURIComponent(link)).toContain('INK-0042')
  })

  it('includes customer name in message', () => {
    const link = buildWhatsAppLink('9876543210', JOB)
    expect(decodeURIComponent(link)).toContain('Priya Sharma')
  })

  it('shows B&W for bw print type', () => {
    const link = buildWhatsAppLink('9876543210', JOB)
    expect(decodeURIComponent(link)).toContain('B&W')
  })

  it('shows Colour for color print type', () => {
    const link = buildWhatsAppLink('9876543210', { ...JOB, printType: 'color' })
    expect(decodeURIComponent(link)).toContain('Colour')
  })

  it('handles unknown page count', () => {
    const link = buildWhatsAppLink('9876543210', { ...JOB, pageCount: null })
    expect(decodeURIComponent(link)).toContain('? pages')
  })
})

describe('buildShopShareLink', () => {
  it('builds a wa.me share URL', () => {
    const link = buildShopShareLink('https://inkneighbour.zakapedia.in/sunshine-apts', 'Sunshine Apartments')
    expect(link).toMatch(/^https:\/\/wa\.me\/\?text=/)
  })

  it('includes the shop URL in the message', () => {
    const shopUrl = 'https://inkneighbour.zakapedia.in/sunshine-apts'
    const link = buildShopShareLink(shopUrl, 'Sunshine Apartments')
    expect(decodeURIComponent(link)).toContain(shopUrl)
  })

  it('includes the society name in the message', () => {
    const link = buildShopShareLink('https://example.com', 'Lakeview Society')
    expect(decodeURIComponent(link)).toContain('Lakeview Society')
  })
})
