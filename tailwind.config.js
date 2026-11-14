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
          'pink-deep': '#e94267',
          hot: '#ff4d80',
          plum: '#5b2a47',
          pale: '#fff5f8',
          line: '#f3dbe4',
          cream: '#fff5f8',
          white: '#ffffff',
          dark: '#5b2a47',
          darker: '#421d33',
          deep: '#301324',
          panel: '#ffffff',
          'panel-hover': '#fff0f4',
          'text-sub': '#a8556f',
          'text-dim': '#946b80'
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
          dark: '#5b2a47',
          darker: '#421d33',
          deep: '#301324',
          panel: '#ffffff',
          'panel-hover': '#fff0f4',
          text: '#5b2a47',
          'text-sub': '#a8556f',
          'text-dim': '#946b80'
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
        torus: ['Nunito', 'Torus', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        sans: ['Nunito', 'Be Vietnam Pro', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      boxShadow: {
        'osu-pink': '0 0 20px rgba(255, 133, 162, 0.45)',
        'osu-pink-lg': '0 0 35px rgba(255, 133, 162, 0.65)',
        'osu-panel': '0 8px 32px rgba(126, 47, 79, 0.1)',
        'kawaii-pink': '0 0 20px rgba(255, 133, 162, 0.45)',
        'kawaii-pink-lg': '0 0 35px rgba(255, 133, 162, 0.65)',
        'kawaii-card': '0 20px 60px rgba(126, 47, 79, 0.1)'
      },
      borderRadius: {
        osu: '16px',
        'osu-sm': '10px',
        'osu-lg': '24px'
      }
    },
  },
  plugins: [],
};
