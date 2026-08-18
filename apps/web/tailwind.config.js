/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
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