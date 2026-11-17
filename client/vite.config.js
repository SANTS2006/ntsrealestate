import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const websiteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../website/public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

// In production the API server serves the public website at "/" (see
// server/src/website.js). This does the same under `npm run dev`, so
// http://localhost:5173/ shows the website and the app's own routes still work.
function websiteDev() {
  return {
    name: 'nts-website-dev',
    configureServer(server) {
      if (!fs.existsSync(path.join(websiteDir, 'index.html'))) return;
      server.middlewares.use((req, res, next) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') return next();
        const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
        const clean = pathname.replace(/\/+$/, '') || '/index';
        const candidates = pathname === '/' ? ['index.html'] : [`${clean.slice(1)}`, `${clean.slice(1)}.html`];
        for (const rel of candidates) {
          const file = path.resolve(websiteDir, rel);
          if (!file.startsWith(websiteDir + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
          res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
          res.setHeader('Cache-Control', 'no-cache');
          return fs.createReadStream(file).pipe(res);
        }
        return next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), websiteDev()],
  server: {
    port: 5173,
    strictPort: true,
    // The website's forms post to a relative /api/v1/... URL (same origin in production).
    proxy: { '/api': 'http://localhost:5000' },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
