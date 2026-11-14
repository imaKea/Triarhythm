/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          red: '#ff1744',
          cyan: '#00e5ff',
          green: '#00e676',
          blue: '#2979ff',
          yellow: '#ffea00',
          orange: '#ff9100',
          pink: '#f50057'
        }
      },
      fontFamily: {
        cyber: ['Orbitron', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
};
