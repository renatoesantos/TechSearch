/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#172033',
        canvas: '#F4F7F2',
        lime: '#B7F34A',
        cobalt: '#3155D9',
        signal: '#F97316',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 12px 35px rgba(23, 32, 51, 0.07)',
      },
    },
  },
  plugins: [],
};
