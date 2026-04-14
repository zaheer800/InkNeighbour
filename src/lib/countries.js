/**
 * Country configuration for global-ready architecture.
 * Add new countries here to expand InkNeighbour without code changes.
 */
export const COUNTRIES = {
  IN: {
    code: 'IN',
    name: 'India',
    currency_code: 'INR',
    currency_symbol: '₹',
    postal_code_label: 'Pincode',
    flat_label: 'Flat',
    society_label: 'Society',
    phone_prefix: '+91',
    phone_regex: /^[6-9]\d{9}$/,
    paper_sizes: ['A4', 'A3'],
    notificationProvider: 'whatsapp',
    smsProvider: null,
    payment_providers: ['upi', 'cash']
  },
  US: {
    code: 'US',
    name: 'United States',
    currency_code: 'USD',
    currency_symbol: '$',
    postal_code_label: 'ZIP Code',
    flat_label: 'Unit',
    society_label: 'Condo',
    phone_prefix: '+1',
    phone_regex: /^\d{10}$/,
    paper_sizes: ['Letter', 'Legal', 'A4'],
    notificationProvider: 'sms',
    smsProvider: 'twilio',
    payment_providers: ['cash']
  },
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    currency_code: 'GBP',
    currency_symbol: '£',
    postal_code_label: 'Postcode',
    flat_label: 'Flat',
    society_label: 'Block of Flats',
    phone_prefix: '+44',
    phone_regex: /^\d{10,11}$/,
    paper_sizes: ['A4', 'A3'],
    notificationProvider: 'whatsapp',
    smsProvider: 'twilio',
    payment_providers: ['cash']
  }
}

export const DEFAULT_COUNTRY = import.meta.env.VITE_DEFAULT_COUNTRY || 'IN'

export function getCountry(code) {
  return COUNTRIES[code] || COUNTRIES[DEFAULT_COUNTRY]
}

export function formatCurrency(amountInSmallestUnit, countryCode) {
  const country = getCountry(countryCode)
  const divisor = country.currency_code === 'INR' ? 100 : 100
  const amount = amountInSmallestUnit / divisor

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: country.currency_code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

export function countryOptions() {
  return Object.values(COUNTRIES).map(c => ({ value: c.code, label: c.name }))
}
