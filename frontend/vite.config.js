import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The website is a standalone SPA that builds to static files (deployed as a
// Render Static Site — see render.yaml). It embeds no server of its own: the
// backend is its own repo and is reached over HTTPS through src/config/api.js,
// whose base URL comes from VITE_API_BASE_URL at build time.
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
