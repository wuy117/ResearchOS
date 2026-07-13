/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Newsreader"', 'Iowan Old Style', 'Georgia', 'serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: '#11192d',
        paper: '#e7eaed',
        ivory: '#f1f3f3',
        moss: '#0d746f',
        brass: '#5364d8',
        graphite: '#596476',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(17, 25, 45, 0.045), 0 5px 16px rgba(17, 25, 45, 0.025)',
        soft: '0 2px 6px rgba(17, 25, 45, 0.045), 0 20px 52px rgba(25, 36, 61, 0.095)',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.5rem',
        md: '0.625rem',
        lg: '0.75rem',
        xl: '0.875rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
