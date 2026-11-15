import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // `public/` là web-root của Laravel (index.php, .htaccess). Asset tĩnh của game
  // nằm ở `static/` để Vite không copy file PHP/nặng vào dist khi build.
  publicDir: 'static',
  plugins: [
    react(),
    // Visualizer cho phân tích bundle size (chỉ khi cần)
    // process.env.ANALYZE && visualizer()
  ],
  server: {
    port: 3000,
    open: true,
    watch: {
      ignored: ['**/_ref/**', '**/storage/**', '**/vendor/**', '**/*.zip', '**/*.mp4', '**/*.rar']
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/storage': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      }
    }
  },
  test: {
    globals: true,
    environment: 'node'
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Tách vendor ra chunk riêng để cache hiệu quả hơn
        manualChunks: {
          vendor: ['react', 'react-dom', 'idb', 'jszip'],
        },
      },
    },
  },
});
