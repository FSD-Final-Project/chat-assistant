import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: (() => {
    const apiTarget = process.env.VITE_API_TARGET ?? "http://localhost:3001";
    return {
      host: "::",
      port: 8080,
      proxy: {
        "/auth": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/users": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    };
  })(),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client'),
    },
  },
}));
