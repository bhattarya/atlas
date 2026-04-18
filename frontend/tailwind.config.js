/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        atlas: {
          bg: '#0a0e1a',
          surface: '#111827',
          border: '#1f2937',
          accent: '#3b82f6',
          warn: '#f59e0b',
          danger: '#ef4444',
          success: '#10b981',
          text: '#e5e7eb',
          muted: '#6b7280',
        },
      },
    },
  },
  plugins: [],
}
