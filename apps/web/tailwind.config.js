/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          900: '#161A2E',
          700: '#4A5170',
          500: '#7D849E',
        },
        surface: {
          canvas: '#ECEEF6',
          paper: '#FFFFFF',
        },
        border: {
          DEFAULT: '#DCDFEC',
        },
        brand: {
          violet: '#4F46E5',
          'violet-hover': '#433CC3',
          'violet-soft': '#EDEDFC',
        },
        status: {
          open: '#0D8F7C',
          'open-hover': '#0B7A69',
          'open-soft': '#E7F4F2',
          warning: '#B4600B',
          'warning-hover': '#995209',
          'warning-soft': '#F8EFE7',
          danger: '#C33A52',
          'danger-hover': '#A63146',
          'danger-soft': '#F9EBEE',
        },
        trace: {
          background: '#12152A',
        },
        night: {
          bg: '#12141A',
          hover: '#1C1F27',
          active: '#20242E',
          border: '#262A34',
          muted: '#8A8F9C',
        },
      },
      animation: {
        'slideUp': 'slideUp 0.3s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'bounce': 'bounce 1s infinite',
      },
      animationDelay: {
        '150': '150ms',
        '300': '300ms',
        '1000': '1000ms',
      },
      keyframes: {
        slideUp: {
          'from': { 
            transform: 'translateY(100%)',
            opacity: '0'
          },
          'to': { 
            transform: 'translateY(0)',
            opacity: '1'
          },
        },
        'slide-up': {
          'from': { 
            transform: 'translateY(100%)'
          },
          'to': { 
            transform: 'translateY(0)'
          },
        }
      }
    },
  },
  plugins: [],
}