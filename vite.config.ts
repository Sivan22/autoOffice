import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';

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
  base: process.env.VITE_BASE || '/',
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: 'src/taskpane/executor/iframe.html', dest: '.' },
      ],
    }),
    {
      name: 'mcp-cors-proxy',
      configureServer(server) {
        const handleProxy = async (req: http.IncomingMessage, res: http.ServerResponse) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(204, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
              'Access-Control-Allow-Headers': '*',
              'Access-Control-Max-Age': '86400',
            });
            res.end();
            return;
          }

          const qs = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
          const target = new URLSearchParams(qs).get('target');
          if (!target) { res.statusCode = 400; res.end('Missing target'); return; }

          let targetUrl: URL;
          try { targetUrl = new URL(target); } catch { res.statusCode = 400; res.end('Invalid target'); return; }

          const body = await new Promise<Buffer>((resolve) => {
            const chunks: Buffer[] = [];
            req.on('data', (c: Buffer) => chunks.push(c));
            req.on('end', () => resolve(Buffer.concat(chunks)));
            req.on('error', () => resolve(Buffer.alloc(0)));
          });

          const forwardHeaders: Record<string, string | string[]> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (!k.startsWith(':') && k !== 'host' && v !== undefined)
              forwardHeaders[k] = v as string | string[];
          }
          if (body.length > 0) forwardHeaders['content-length'] = String(body.length);

          const agent = targetUrl.protocol === 'https:' ? https : http;
          const port = Number(targetUrl.port) || (targetUrl.protocol === 'https:' ? 443 : 80);

          const proxyReq = agent.request(
            { hostname: targetUrl.hostname, port, path: targetUrl.pathname + targetUrl.search,
              method: req.method, headers: { ...forwardHeaders, host: targetUrl.host },
              rejectUnauthorized: false },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode ?? 200, {
                ...proxyRes.headers,
                'access-control-allow-origin': '*',
                'x-accel-buffering': 'no',
              });
              proxyRes.on('data', (chunk: Buffer) => res.write(chunk));
              proxyRes.on('end', () => res.end());
              proxyRes.on('error', () => { if (!res.writableEnded) res.end(); });
            },
          );

          proxyReq.on('error', (err) => {
            if (!res.headersSent) { res.statusCode = 502; res.end(String(err)); }
          });

          proxyReq.end(body);
        };

        server.middlewares.use('/api/mcp-proxy', (req: http.IncomingMessage, res: http.ServerResponse) => {
          handleProxy(req, res).catch((err) => {
            console.error('[mcp-cors-proxy]', err);
            if (!res.headersSent) { res.statusCode = 500; res.end(String(err)); }
          });
        });
      },
    },
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
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api\/openai/, ''),
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
