/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nsr: {
          navy:       '#002147',
          'navy-dark':'#001530',
          'navy-mid': '#0a3060',
          wine:       '#660000',
          'wine-mid': '#8B0000',
          'wine-dark':'#4d0000',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
