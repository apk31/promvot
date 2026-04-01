import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174, // <-- Change this to any free port you want
    strictPort: true, // <-- Tells Vite to throw an error if 5174 is taken, rather than silently switching ports
    host: true // <-- This allows the server to be accessed from the local network, which is useful for testing on other devices
  }
})
