/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg        : '#07080A',
        surface   : '#0F1115',
        surface2  : '#151820',
        surface3  : '#1C2130',
        border    : '#1E2230',
        accent    : '#00C853',
        accent2   : '#FF6B35',
        accent3   : '#4AAFFF',
        textprimary: '#E8ECF4',
        textsecond : '#7A8090',
        textthird  : '#3A404E',
        danger    : '#FF4757',
        warn      : '#FFB300',
      },
      fontFamily: {
        sans : ['Plus Jakarta Sans', 'sans-serif'],
        mono : ['Space Mono', 'monospace'],
      },
      borderRadius: {
        DEFAULT: '12px',
        sm      : '8px',
      },
    },
  },
  plugins: [],
};
