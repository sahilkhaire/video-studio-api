import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('recharts')) {
            return 'vendor-charts';
          }

          if (
            id.includes('@tanstack/react-table') ||
            id.includes('@dnd-kit') ||
            id.includes('zod')
          ) {
            return 'vendor-table';
          }

          if (
            id.includes('radix-ui') ||
            id.includes('vaul') ||
            id.includes('sonner')
          ) {
            return 'vendor-ui';
          }

          if (id.includes('react')) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
