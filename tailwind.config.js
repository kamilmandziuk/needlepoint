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
    },
  },
  plugins: [],
};
