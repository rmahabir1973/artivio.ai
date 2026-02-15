import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  
  root: './public', // index.html is in /public folder
  
  build: {
    outDir: '../dist', // Output to /dist (one level up from /public)
    emptyOutDir: true,
    sourcemap: false,
  },
  
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client')
    }
  },
  
  server: {
    port: 5173,
    strictPort: false,
    host: true
  }
});
