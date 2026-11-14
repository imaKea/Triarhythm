/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        osu: {
          pink: '#ff66ab',
          'pink-dark': '#cc5289',
          'pink-light': '#ff8ac0',
          purple: '#6c5ce7',
          'purple-dark': '#4834d4',
          blue: '#4fc3f7',
          yellow: '#ffdd57',
          green: '#66bb6a',
          red: '#ef5350',
          dark: '#1a1a2e',
          darker: '#111122',
          deep: '#0d0d1a',
          panel: '#222238',
          'panel-hover': '#2f2f4a',
          text: '#ffffff',
          'text-sub': '#b8c0d4',
          'text-dim': '#7c849c'
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
        'osu-pink': '0 0 20px rgba(255, 102, 171, 0.4)',
        'osu-pink-lg': '0 0 30px rgba(255, 102, 171, 0.6)',
        'osu-panel': '0 8px 32px rgba(0, 0, 0, 0.45)'
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
