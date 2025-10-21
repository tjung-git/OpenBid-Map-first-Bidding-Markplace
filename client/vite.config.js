import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true, // Makes expect, describe, it, etc. globally available
    setupFiles: './src/setupTests.js', // Path to your test setup file
  },
});
