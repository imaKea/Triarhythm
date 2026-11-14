import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // `public/` là web-root của Laravel (index.php, .htaccess). Asset tĩnh của game
  // nằm ở `static/` để Vite không copy file PHP/nặng vào dist khi build.
  publicDir: 'static',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  }
});
