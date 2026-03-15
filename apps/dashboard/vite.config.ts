import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 1600, // vendor-pdf (@react-pdf/renderer) is ~1.6MB but loads only on InvoiceDetail
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router', 'react-router-dom'],
          'vendor-clerk': ['@clerk/clerk-react'],
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-table'],
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          'vendor-recharts': ['recharts'],
          'vendor-pdf': ['@react-pdf/renderer'],
        },
      },
    },
  },
});
