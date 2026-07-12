/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['Newsreader', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#202a34',
        paper: '#f4f2ec',
        ivory: '#fcfbf8',
        moss: '#526b5a',
        brass: '#825c30',
        graphite: '#394653',
      },
      boxShadow: {
        soft: '0 24px 72px rgba(32, 42, 52, 0.13)',
      },
    },
  },
  plugins: [],
};
