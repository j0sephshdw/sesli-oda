import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // React eklentisi
  plugins: [react()],

  // Klasör yolları için kısayollar (Alias)
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Geliştirici Sunucusu Ayarları
  server: {
    port: 5173,
    strictPort: true, 
    open: true,       
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false, 
      },
    },
  },

  // Üretim (Production) Derleme Ayarları
  build: {
    outDir: 'dist',
    emptyOutDir: true, 
    sourcemap: true,   
    minify: 'esbuild', 
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'; 
          }
        }
      }
    }
  },
});