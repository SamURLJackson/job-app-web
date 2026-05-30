/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        ink: {
          DEFAULT: '#0D0D0D',
          50: '#F5F5F3',
          100: '#E8E8E4',
          200: '#C8C8C0',
          300: '#A0A096',
          400: '#6E6E64',
          500: '#4A4A42',
          600: '#2E2E28',
          700: '#1C1C18',
          800: '#131310',
          900: '#0D0D0D',
        },
        sage: {
          DEFAULT: '#7C9E87',
          50: '#F2F6F3',
          100: '#E0EBE3',
          200: '#BBCFC0',
          300: '#97B49E',
          400: '#7C9E87',
          500: '#618870',
          600: '#4D6E59',
          700: '#3A5344',
          800: '#283A30',
          900: '#18231D',
        },
        amber: {
          DEFAULT: '#D4A853',
          light: '#E8C47A',
          dark: '#A8832F',
        },
        cream: '#F9F7F2',
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'fade-in': 'fadeIn 0.3s ease forwards',
        'slide-in': 'slideIn 0.35s ease forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: 0, transform: 'translateY(12px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        },
        slideIn: {
          '0%': { opacity: 0, transform: 'translateX(-8px)' },
          '100%': { opacity: 1, transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
