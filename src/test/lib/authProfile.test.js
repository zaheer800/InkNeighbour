import { describe, it, expect } from 'vitest'
import { signUpMetadata } from '../../lib/authProfile'

describe('signUpMetadata', () => {
  it('sets the display name under the keys Supabase and the app read', () => {
    const m = signUpMetadata({ name: '  Ravi Kumar ', phone: '+919876543210', provider_type: 'shop', shop_name: 'Print & Co' })
    expect(m).toEqual({
      display_name: 'Ravi Kumar',
      full_name: 'Ravi Kumar',
      name: 'Ravi Kumar',
      phone: '+919876543210',
      provider_type: 'shop',
      shop_name: 'Print & Co',
    })
  })

  it('leaves out empty and missing fields instead of storing blanks', () => {
    expect(signUpMetadata({ name: 'A', phone: '  ', provider_type: 'home', shop_name: undefined })).toEqual({
      display_name: 'A',
      full_name: 'A',
      name: 'A',
      provider_type: 'home',
    })
    expect(signUpMetadata()).toEqual({})
  })

  it('ignores non-string values', () => {
    expect(signUpMetadata({ name: 42, phone: null })).toEqual({})
  })
})
