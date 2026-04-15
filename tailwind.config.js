/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        ink:     '#0A0A0F',
        ink2:    '#1A1A2E',
        surface: '#FFFFFF',
        bg:      '#F4F3FF',
        orange:  '#FF6B35',
        orange2: '#FF8C61',
        violet:  '#7C3AED',
        violet2: '#A78BFA',
        sky:     '#06B6D4',
        green:   '#10B981',
        amber:   '#F59E0B',
        red:     '#EF4444',
        muted:   '#6B7280',
        border:  '#E5E7EB'
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body:    ['Inter', 'sans-serif']
      },
      fontSize: {
        base: '18px'
      },
      borderRadius: {
        DEFAULT: '12px',
        lg:      '16px',
        xl:      '20px',
        pill:    '100px'
      },
      minHeight: {
        tap: '48px',
        btn: '52px'
      },
      boxShadow: {
        orange: '0 4px 16px rgba(255,107,53,0.35)',
        violet: '0 4px 16px rgba(124,58,237,0.35)',
        card:   '0 2px 12px rgba(10,10,15,0.08)'
      }
    }
  },
  plugins: []
}
