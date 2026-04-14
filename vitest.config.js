import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/lib/**', 'src/payments/**', 'src/notifications/**', 'src/components/**', 'src/pages/**'],
      exclude: ['src/test/**', 'src/**/__mocks__/**']
    },
    // Silence noisy console output from pdfjs-dist worker import
    silent: false
  },
  resolve: {
    alias: { '@': '/src' }
  }
})
