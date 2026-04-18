/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        umbc: {
          black: '#000000',
          gold: '#FFC300',
          'gold-light': '#FFD84D',
          'gold-dim': '#CC9C00',
        },
        surface: {
          bg: '#f7f6f1',
          card: '#ffffff',
          muted: '#f0efe9',
          border: '#e8e7e0',
        },
        ink: {
          DEFAULT: '#111111',
          secondary: '#555555',
          muted: '#999999',
          light: '#cccccc',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        mascot: ['"Bebas Neue"', 'Impact', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 4px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)',
        panel: '-4px 0 40px 0 rgba(0,0,0,0.10)',
        node: '0 2px 8px 0 rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
