import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const anthropicProxy = {
  '/anthropic': {
    target: 'https://api.anthropic.com',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/anthropic/, ''),
  },
};

export default defineConfig({
  plugins: [react()],
  server: { proxy: anthropicProxy },
  preview: { proxy: anthropicProxy },
});
