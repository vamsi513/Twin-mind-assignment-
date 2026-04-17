/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#13131f',
        surface: '#1a1a2e',
        border: '#2a2a3f',
        muted: '#6b7280',
      },
      keyframes: {
        pulse_dot: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0.3 },
        },
        blink: {
          '0%, 100%': { opacity: 1 },
          '50%': { opacity: 0 },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        pulse_dot: 'pulse_dot 1.2s ease-in-out infinite',
        blink: 'blink 1s step-end infinite',
        shimmer: 'shimmer 1.5s infinite linear',
      },
    },
  },
  plugins: [],
}
