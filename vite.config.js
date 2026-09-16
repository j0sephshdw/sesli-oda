import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/get-token': 'http://localhost:3000',
      '/ping': 'http://localhost:3000'
    }
  }
});