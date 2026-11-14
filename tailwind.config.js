/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kawaii: {
          pink: '#ff85a2',
          'pink-light': '#ffaec9',
          'pink-soft': '#ffd6e0',
          'pink-dark': '#ff4d80',
          'pink-deep': '#e02868',
          cream: '#fff5f8',
          white: '#ffffff',
          dark: '#1e1124',
          darker: '#160c1a',
          deep: '#100814',
          panel: '#28162e',
          'panel-hover': '#351d3d',
          'text-sub': '#e2cbe4',
          'text-dim': '#a890aa'
        },
        osu: {
          pink: '#ff85a2',
          'pink-dark': '#ff4d80',
          'pink-light': '#ffaec9',
          purple: '#b388ff',
          'purple-dark': '#7c4dff',
          blue: '#4fc3f7',
          yellow: '#ffe082',
          green: '#a7f3d0',
          red: '#ff6b81',
          dark: '#1e1124',
          darker: '#160c1a',
          deep: '#100814',
          panel: '#28162e',
          'panel-hover': '#351d3d',
          text: '#ffffff',
          'text-sub': '#e2cbe4',
          'text-dim': '#a890aa'
        },
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
        torus: ['Torus', 'Nunito', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'osu-pink': '0 0 20px rgba(255, 133, 162, 0.45)',
        'osu-pink-lg': '0 0 35px rgba(255, 133, 162, 0.65)',
        'osu-panel': '0 8px 32px rgba(22, 12, 26, 0.65)',
        'kawaii-pink': '0 0 20px rgba(255, 133, 162, 0.45)',
        'kawaii-pink-lg': '0 0 35px rgba(255, 133, 162, 0.65)',
        'kawaii-card': '0 8px 30px rgba(255, 133, 162, 0.18)'
      },
      borderRadius: {
        osu: '12px',
        'osu-sm': '8px',
        'osu-lg': '16px'
      }
    },
  },
  plugins: [],
};
