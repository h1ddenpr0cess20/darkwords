import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Anthropic's Files API doesn't answer CORS preflights (the Messages API
// does), so code-interpreter file outputs can't be downloaded directly from
// the browser. /anthropic/* is proxied to api.anthropic.com same-origin
// instead; nginx.conf and vercel.json carry the equivalent for production.
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
