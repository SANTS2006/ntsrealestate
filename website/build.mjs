// Static site builder for the NTS Real Estate System marketing website.
//
//   node website/build.mjs            (or: npm run build:website)
//
// Reads every page fragment in website/src/*.html, wraps it with the shared
// <head> (SEO tags + structured data), header, footer and WhatsApp button, and
// writes the finished pages to website/public/ — the folder the API server
// serves at "/". It also writes sitemap.xml and robots.txt.
//
// Set SITE_URL (e.g. https://www.example.com) so canonical links, social tags
// and the sitemap carry your real domain. On Render, RENDER_EXTERNAL_URL is
// used automatically. Contact details live in ONE place (CONFIG below).

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = join(root, 'public');
mkdirSync(outDir, { recursive: true });

// ───────────────────────── Contact + brand configuration ─────────────────────────
const CONFIG = {
  brand: 'NTS Real Estate System',
  company: 'NTS Digital Solutions',
  email: 'hello@ntsdigitalsolutions.com', // <- confirm the exact domain
  phoneDisplay: '+232 31 034 604',
  phoneTel: '+23231034604',
  waNumber: '23231034604', // international format, digits only (wa.me requirement)
  waDefaultText:
    "Hello NTS Digital Solutions, I'd like to know more about the NTS Real Estate System.",
  year: new Date().getFullYear(),
  siteUrl: (process.env.SITE_URL || process.env.RENDER_EXTERNAL_URL || 'https://ntsrealestate.onrender.com').replace(/[/]+$/, ''),
};
const waUrl = (text = CONFIG.waDefaultText) =>
  `https://wa.me/${CONFIG.waNumber}?text=${encodeURIComponent(text)}`;

// ───────────────────────── Icons (inline SVG) ─────────────────────────
const stroke = (d) =>
  `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICONS = {
  building: stroke('<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h1M9 13h1M9 17h1M14 9h1M14 13h1M14 17h1"/>'),
  users: stroke('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.5a3.5 3.5 0 010 7M18 14.5c2.2.6 3.5 2.5 3.5 5.5"/>'),
  file: stroke('<path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
  key: stroke('<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M16 7l3 3M14 9l2 2"/>'),
  wallet: stroke('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  receipt: stroke('<path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2z"/><path d="M9 8h6M9 12h6"/>'),
  wrench: stroke('<path d="M14.5 6.5a4 4 0 00-5.2 5.2L3 18l3 3 6.3-6.3a4 4 0 005.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z"/>'),
  clipboard: stroke('<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 14l2 2 4-4"/>'),
  chart: stroke('<path d="M4 20V4M4 20h16M8 16v-5M13 16V8M18 16v-3"/>'),
  shield: stroke('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  lock: stroke('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>'),
  bell: stroke('<path d="M6 16v-5a6 6 0 0112 0v5l2 2H4zM10 21h4"/>'),
  chat: stroke('<path d="M4 5h16v11H9l-5 4z"/>'),
  land: stroke('<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14"/>'),
  tag: stroke('<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>'),
  network: stroke('<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 11l7.6-4M8.2 13l7.6 4"/>'),
  database: stroke('<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>'),
  cloud: stroke('<path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.5A3.3 3.3 0 0117 18z"/>'),
  palette: stroke('<path d="M12 3a9 9 0 100 18c1.5 0 2-1 1.5-2s0-2 1.5-2h2a3 3 0 003-3c0-6-4-11-8-11z"/><circle cx="8" cy="10" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16" cy="10" r="1"/>'),
  phone: stroke('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/>'),
  mail: stroke('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
  arrow: stroke('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  check: stroke('<path d="M5 12l5 5 9-10"/>'),
  spark: stroke('<path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/>'),
  home: stroke('<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/>'),
  layers: stroke('<path d="M12 3l9 5-9 5-9-5zM3 13l9 5 9-5"/>'),
  mobile: stroke('<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>'),
  globe: stroke('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  eye: stroke('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
  calendar: stroke('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  coins: stroke('<circle cx="9" cy="9" r="6"/><path d="M15 9.5A6 6 0 1115.5 21M9 7v4M7.5 9h3"/>'),
  menu: stroke('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: stroke('<path d="M6 6l12 12M18 6L6 18"/>'),
  up: stroke('<path d="M12 19V5M6 11l6-6 6 6"/>'),
  whatsapp:
    '<svg class="ic ic-fill" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
};

// ───────────────────────── Navigation ─────────────────────────
// [key, label, path]. Paths are clean URLs ("/features"); the server resolves them to the built .html files.
const NAV = [
  ['home', 'Home', '/'],
  ['features', 'Features', '/features'],
  ['solutions', 'Solutions', '/solutions'],
  ['how', 'How it works', '/how-it-works'],
  ['pricing', 'Pricing', '/pricing'],
  ['about', 'About', '/about'],
  ['contact', 'Contact', '/contact'],
];

const header = (active) => `
<header class="site-header" id="top">
  <div class="container nav">
    <a class="brand" href="/" aria-label="${CONFIG.brand} home">
      <img src="/site/img/logo.png" alt="" width="40" height="40"><span>NTS <em>Real Estate</em></span>
    </a>
    <nav class="nav-links" id="nav-links" aria-label="Main">
      ${NAV.map(([k, label, href]) => `<a href="${href}"${k === active ? ' class="active" aria-current="page"' : ''}>${label}</a>`).join('\n      ')}
      <a class="btn btn-primary nav-cta" href="/demo">Request a demo {{i:arrow}}</a>
    </nav>
    <button class="nav-toggle" id="nav-toggle" aria-label="Open menu" aria-expanded="false" aria-controls="nav-links">{{i:menu}}</button>
  </div>
</header>`;

const footer = () => `
<footer class="site-footer">
  <div class="container">
    <div class="foot-cta reveal">
      <div>
        <h2>Ready to see it running on your portfolio?</h2>
        <p>Talk to our team and get a walkthrough built around how you actually manage property.</p>
      </div>
      <div class="foot-cta-btns">
        <a class="btn btn-primary" href="/demo">Request a demo {{i:arrow}}</a>
        <a class="btn btn-wa" href="${waUrl()}" target="_blank" rel="noopener" data-wa>{{i:whatsapp}} Chat on WhatsApp</a>
      </div>
    </div>
    <div class="foot-grid">
      <div class="foot-brand">
        <a class="brand" href="/"><img src="/site/img/logo.png" alt="" width="40" height="40" loading="lazy"><span>NTS <em>Real Estate</em></span></a>
        <p>Property, tenant, lease, finance and maintenance management for real estate teams. Built by ${CONFIG.company}.</p>
        <ul class="contact-list">
          <li>{{i:mail}}<a href="mailto:${CONFIG.email}">${CONFIG.email}</a></li>
          <li>{{i:phone}}<a href="tel:${CONFIG.phoneTel}">${CONFIG.phoneDisplay}</a></li>
          <li>{{i:whatsapp}}<a href="${waUrl()}" target="_blank" rel="noopener" data-wa>WhatsApp ${CONFIG.phoneDisplay}</a></li>
        </ul>
      </div>
      <nav aria-label="Product">
        <h3>Product</h3>
        <a href="/features">Features</a><a href="/solutions">Solutions</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a>
      </nav>
      <nav aria-label="Company">
        <h3>Company</h3>
        <a href="/about">About</a><a href="/faq">FAQ</a><a href="/contact">Contact us</a><a href="/demo">Request a demo</a>
      </nav>
      <nav aria-label="Legal">
        <h3>Legal</h3>
        <a href="/privacy">Privacy policy</a><a href="/terms">Terms of service</a>
      </nav>
    </div>
    <div class="foot-base">
      <span>© ${CONFIG.year} ${CONFIG.company}. All rights reserved.</span>
      <span>${CONFIG.brand}</span>
    </div>
  </div>
</footer>

<a class="wa-fab" href="${waUrl()}" target="_blank" rel="noopener" data-wa aria-label="Chat with us on WhatsApp (${CONFIG.phoneDisplay})">
  <span class="wa-tip">Chat with us on WhatsApp</span>
  <span class="wa-ico">{{i:whatsapp}}</span>
</a>
<button class="to-top" id="to-top" aria-label="Back to top">{{i:up}}</button>`;

// ───────────────────────── SEO helpers ─────────────────────────
const SCENES = new Set(['building', 'lattice']);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\{\{i:[a-z]+\}\}/g, '').replace(/\s+/g, ' ').trim();
const abs = (p) => `${CONFIG.siteUrl}${p}`;
const OG_IMAGE = abs('/site/img/logo.png');

/** Structured data (JSON-LD) for the page: organisation, site, breadcrumbs and page-type specifics. */
function jsonLd(meta, body, path) {
  const orgId = abs('/#organization');
  const graph = [
    {
      '@type': 'Organization', '@id': orgId, name: CONFIG.company, url: abs('/'),
      logo: { '@type': 'ImageObject', url: OG_IMAGE, width: 512, height: 512 },
      email: CONFIG.email, telephone: CONFIG.phoneTel,
      contactPoint: [{ '@type': 'ContactPoint', contactType: 'sales and customer support', telephone: CONFIG.phoneTel, email: CONFIG.email, availableLanguage: 'English' }],
    },
    { '@type': 'WebSite', '@id': abs('/#website'), url: abs('/'), name: CONFIG.brand, publisher: { '@id': orgId }, inLanguage: 'en' },
  ];
  if (meta.home) {
    graph.push({
      '@type': 'SoftwareApplication', name: CONFIG.brand, applicationCategory: 'BusinessApplication', operatingSystem: 'Web',
      description: meta.desc, url: abs('/'), publisher: { '@id': orgId },
      featureList: ['Properties, buildings and units', 'Tenants and leases', 'Invoicing and payments', 'Expenses with approvals', 'Maintenance and work orders', 'Inspections and documents', 'Land and deals', 'Reports and audit log', 'Role-based access and MFA'],
    });
  } else {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: abs('/') },
        { '@type': 'ListItem', position: 2, name: meta.crumb || meta.title, item: abs(path) },
      ],
    });
    graph.push({ '@type': meta.pageType || 'WebPage', '@id': abs(path) + '#webpage', url: abs(path), name: meta.title, description: meta.desc, isPartOf: { '@id': abs('/#website') }, about: { '@id': orgId } });
  }
  if (meta.faq) {
    const items = [...body.matchAll(/<details[^>]*><summary>([\s\S]*?)<\/summary><p>([\s\S]*?)<\/p><\/details>/g)];
    graph.push({
      '@type': 'FAQPage',
      mainEntity: items.map(([, q, a]) => ({ '@type': 'Question', name: stripTags(q), acceptedAnswer: { '@type': 'Answer', text: stripTags(a) } })),
    });
  }
  // "<" is escaped so the JSON can never close its own <script> element.
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function render(meta, body, path) {
  const scene = SCENES.has(meta.scene) ? meta.scene : '';
  const url = abs(path);
  const robots = meta.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.desc)}">
${meta.keywords ? `<meta name="keywords" content="${esc(meta.keywords)}">\n` : ''}<meta name="robots" content="${robots}">
<meta name="author" content="${CONFIG.company}">
<meta name="theme-color" content="#05070f">
<link rel="canonical" href="${url}">
<link rel="icon" href="/site/img/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${CONFIG.brand}">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:image:width" content="512">
<meta property="og:image:height" content="512">
<meta property="og:image:alt" content="${CONFIG.brand} logo">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.desc)}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="preload" href="/site/fonts/sora-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/site/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/site/css/fonts.css">
<link rel="stylesheet" href="/site/css/style.css">
<script src="/site/js/boot.js"></script>
<script type="application/ld+json">${jsonLd(meta, body, path)}</script>
</head>
<body data-wa-number="${CONFIG.waNumber}"${scene ? ` data-scene="${scene}"` : ''}>
<a class="skip" href="#main">Skip to content</a>
${header(meta.nav)}
<main id="main">
${body}
</main>
${footer()}
${scene ? '<script src="/site/js/three.min.js" defer></script>\n<script src="/site/js/scene.js" defer></script>' : ''}
<script src="/site/js/main.js" defer></script>
</body>
</html>
`;
}

function fill(html) {
  return html
    // authoring convenience: page fragments may use plain "x.html" links; publish them as clean URLs
    .replace(/href="index\.html"/g, 'href="/"')
    .replace(/href="([a-z0-9-]+)\.html"/g, 'href="/$1"')
    .replaceAll('src="assets/logo.png"', 'src="/site/img/logo.png"')
    .replace(/\{\{i:([a-z]+)\}\}/g, (_, n) => {
      if (!ICONS[n]) throw new Error(`Unknown icon: ${n}`);
      return ICONS[n];
    })
    .replace(/\{\{wa:(.*?)\}\}/g, (_, t) => waUrl(t))
    .replaceAll('{{WA}}', waUrl())
    .replaceAll('{{EMAIL}}', CONFIG.email)
    .replaceAll('{{PHONE}}', CONFIG.phoneDisplay)
    .replaceAll('{{TEL}}', CONFIG.phoneTel)
    .replaceAll('{{COMPANY}}', CONFIG.company)
    .replaceAll('{{BRAND}}', CONFIG.brand);
}

// ───────────────────────── Build ─────────────────────────
const srcDir = join(root, 'src');
const today = new Date().toISOString().slice(0, 10);
const sitemap = [];
for (const file of readdirSync(srcDir).filter((f) => f.endsWith('.html'))) {
  const raw = readFileSync(join(srcDir, file), 'utf8');
  const m = raw.match(/^<!--meta\s*(\{[\s\S]*?\})\s*-->\s*/);
  if (!m) throw new Error(`${file}: missing <!--meta {...}--> header`);
  const meta = JSON.parse(m[1]);
  const name = file.replace(/\.html$/, '');
  const path = name === 'home' ? '/' : `/${name}`;
  const outName = name === 'home' ? 'index.html' : file;
  if (meta.title.length > 65) console.warn(`  ! ${file}: title is ${meta.title.length} chars (keep ≤ 60-65)`);
  if (meta.desc.length > 165 || meta.desc.length < 70) console.warn(`  ! ${file}: description is ${meta.desc.length} chars (aim for 70-160)`);
  writeFileSync(join(outDir, outName), fill(render(meta, raw.slice(m[0].length), path)));
  if (!meta.noindex) sitemap.push({ path, priority: meta.priority ?? 0.6 });
  console.log('built', outName);
}

sitemap.sort((a, b) => b.priority - a.priority || a.path.localeCompare(b.path));
writeFileSync(join(outDir, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemap.map((s) => `  <url><loc>${abs(s.path)}</loc><lastmod>${today}</lastmod><priority>${s.priority.toFixed(1)}</priority></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(outDir, 'robots.txt'), `User-agent: *
Allow: /
Disallow: /api/
Disallow: /platform-admin

Sitemap: ${abs('/sitemap.xml')}
`);
console.log(`built sitemap.xml (${sitemap.length} URLs) and robots.txt for ${CONFIG.siteUrl}`);
