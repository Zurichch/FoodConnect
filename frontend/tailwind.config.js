/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // FoodConnect brand palette: soft greens with a dark green for primary actions
        brand: {
          50: '#f0faf3',
          100: '#dcf3e3',
          200: '#bbe5c9',
          300: '#8dd1a6',
          400: '#58b47c',
          500: '#35975d',
          600: '#257a49',
          700: '#1e623c',
          800: '#1a4e32',
          900: '#16402a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
