/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './app/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F0F',
        card: '#1A1A1A',
        accent: '#6C63FF',
        'accent-dim': 'rgba(108,99,255,0.2)',
        muted: '#888888',
        border: '#2A2A2A',
      },
    },
  },
  plugins: [],
};
