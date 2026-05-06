/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#F0F3FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#7B8FF5',
          500: '#4A6CF7',
          600: '#3B5DE0',
          700: '#2D4AB8',
          800: '#1B2559',
          900: '#111C44'
        },
        surface: {
          bg: '#F4F7FE',
          card: '#FFFFFF',
          border: '#E9EDF7',
          hover: '#F8FAFC'
        },
        navy: {
          DEFAULT: '#1B2559',
          light: '#2B3674',
          muted: '#8F9BBA'
        },
        success: '#01B574',
        danger: '#E31A1A',
        warn: '#FFB547',
        info: '#4A6CF7'
      },
      boxShadow: {
        card: '0 3px 14px rgba(27,37,89,0.04)',
        cardHover: '0 6px 24px rgba(27,37,89,0.08)',
        sidebar: '4px 0 20px rgba(27,37,89,0.03)',
        float: '0 8px 30px rgba(27,37,89,0.10)'
      }
    }
  },
  plugins: []
};
