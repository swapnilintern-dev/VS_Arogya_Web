import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The website is a standalone SPA. It never proxies to the Flutter app and it
// never embeds a server of its own — the existing self/server backend is the
// only backend, reached through src/config/api.js once VITE_USE_MOCK=false.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, open: false },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split the charting library out of the main bundle: only the two
        // analytics surfaces need it, so every other page loads less.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
});
