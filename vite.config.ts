import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';

// Try to load dev certs for HTTPS (required for Office sideloading)
function getHttpsConfig() {
  const certDir = path.resolve(process.env.HOME || '', '.office-addin-dev-certs');
  const certFile = path.join(certDir, 'localhost.crt');
  const keyFile = path.join(certDir, 'localhost.key');
  if (fs.existsSync(certFile) && fs.existsSync(keyFile)) {
    return { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile) };
  }
  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'src/taskpane/executor/iframe.html', dest: '.' },
      ],
    }),
  ],
  server: {
    port: 3721,
    https: getHttpsConfig(),
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
    proxy: {
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/anthropic/, ''),
        secure: true,
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/openai/, ''),
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
