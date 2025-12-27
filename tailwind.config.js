/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Custom colors for the graph editor
        canvas: {
          bg: '#1a1a2e',
          grid: '#252542',
        },
        node: {
          pending: '#374151',
          generating: '#1d4ed8',
          complete: '#15803d',
          error: '#dc2626',
          warning: '#d97706',
        },
      },
      animation: {
        'slide-in': 'slideIn 0.2s ease-out',
      },
      keyframes: {
        slideIn: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
