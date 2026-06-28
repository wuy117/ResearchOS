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
        ink: '#1f2933',
        paper: '#f7f5f0',
        ivory: '#fffdf8',
        moss: '#586f5f',
        brass: '#a77942',
        graphite: '#44515e',
      },
      boxShadow: {
        soft: '0 24px 80px rgba(37, 43, 52, 0.11)',
      },
    },
  },
  plugins: [],
};
