import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In development the React app proxies API + websocket calls to the Express server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000',
      '/socket.io': { target: 'http://localhost:5000', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
