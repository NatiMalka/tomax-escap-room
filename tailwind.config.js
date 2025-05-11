/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      gridTemplateRows: {
        '12': 'repeat(12, minmax(0, 1fr))',
      },
      animation: {
        'glitch': 'glitch 1s linear infinite',
        'scanline': 'scanline 6s linear infinite',
      },
      keyframes: {
        glitch: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
          '25%, 75%': { opacity: '0.9', transform: 'translate(0.5px, 0)' },
          '33%, 66%': { opacity: '0.9', transform: 'translate(-0.5px, 0)' },
        },
        scanline: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
    },
  },
  plugins: [],
} 