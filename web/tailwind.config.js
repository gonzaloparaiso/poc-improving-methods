/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tn: {
          yellow: '#F5C300',
          'yellow-dark': '#D4A800',
          black: '#0A0A0A',
          dark: '#141414',
          card: '#1C1C1C',
          border: '#2A2A2A',
          muted: '#6B6B6B',
          light: '#F0F0F0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
