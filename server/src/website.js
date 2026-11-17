import express, { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The public marketing website (see /website). It is the home page of the
// system: "/" is the site's index, and each page lives at a clean URL
// ("/features" -> features.html). Everything the React app serves lives
// elsewhere (/api, /assets, /:orgSlug/login, /dashboard, …), none of which
// collide with the site's page names.
//
// Mounted early, ahead of the session and rate-limit middleware, so a visitor
// reading the site never touches the session store or burns their API quota.
export const websiteDir = path.join(__dirname, '../../website/public');

export function websiteRouter() {
  const router = Router();
  if (!fs.existsSync(path.join(websiteDir, 'index.html'))) return router; // site not built: fall through to the app

  // "/features.html" and "/index.html" are duplicates of the clean URLs — send them there (one canonical URL per page for search engines).
  router.get(/^\/([a-z0-9-]+)\.html$/, (req, res, next) => {
    const name = req.params[0];
    if (!fs.existsSync(path.join(websiteDir, `${name}.html`))) return next();
    res.redirect(301, name === 'index' ? '/' : `/${name}`);
  });

  router.use(express.static(websiteDir, {
    extensions: ['html'],
    index: 'index.html',
    redirect: false,
    setHeaders(res, filePath) {
      if (/\.html$/.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
      // The site's own CSS/JS change with edits and aren't fingerprinted, so they revalidate hourly; fonts, images and three.js never change.
      else if (/[\\/]site[\\/](css|js)[\\/](?!three)/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
      else if (/[\\/]site[\\/]/.test(filePath)) res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
      else res.setHeader('Cache-Control', 'public, max-age=3600'); // sitemap.xml, robots.txt
    },
  }));
  return router;
}
