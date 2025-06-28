// frontend/vite.config.js

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Add this 'define' property to polyfill 'global' for browser compatibility
  define: {
    global: 'window', // <-- THIS LINE IS THE FIX
  },
});

