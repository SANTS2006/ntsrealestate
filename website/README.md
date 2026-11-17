# NTS Real Estate System — public website

The marketing website. It **is the home page of the system**: the API server serves it at `/`
(see `server/src/website.js`), and the React app lives alongside it (`/:orgSlug/login`,
`/dashboard`, `/platform-admin/...`). There is no sign-in or sign-up button on the site — only a
**Contact** form and a **Request a demo** form.

```
website/
  build.mjs        generates every page + sitemap.xml + robots.txt   (npm run build:website)
  src/*.html       page content (one fragment per page, with a <!--meta {...}--> SEO header)
  public/          GENERATED output, served by the server: pages, sitemap.xml, robots.txt, site/{css,js,fonts,img}
```

## Editing

1. Edit a page in `src/` (or `public/site/css|js` for styling and behaviour).
2. Run `npm run build:website`. Pages are written to `public/` and committed, so a deploy works even
   without the build step; the Render build also runs it so canonical URLs match the live domain.

Contact details (email, phone, WhatsApp number) live in one place: the `CONFIG` block at the top of `build.mjs`.

## SEO

Each page gets a unique title and description (set in its `<!--meta-->` header; the build warns if they
are too long or short), a canonical URL, Open Graph and Twitter tags, JSON-LD structured data
(Organization, WebSite, SoftwareApplication, BreadcrumbList, FAQPage, ContactPage), `sitemap.xml` and
`robots.txt`. Fonts, three.js and images are self-hosted, so the pages need no third-party requests and
work under the server's strict Content-Security-Policy.

Set **`SITE_URL`** (for example `https://www.yourdomain.com`) before building so canonical links and the
sitemap use your real domain. On Render it defaults to the service URL (`RENDER_EXTERNAL_URL`).

## Forms

Both forms `POST /api/v1/public/platform-inquiries` (rate limited, validated, honeypot-protected). Each
submission is stored in the `platform_inquiries` table, emailed to the active platform admins (and
`SUPPORT_EMAIL` if set), and appears in the platform console under **Inquiries**, where it can be marked
read / replied / archived. Deploying needs the `20261117090000_platform_inquiries` migration
(`npm run deploy:migrate`, already part of the Render build).

## Hidden platform-admin shortcut

Clicking blank space in the navbar five times in quick succession opens `/platform-admin/login`.

## Running locally

`npm run dev` starts the API (5000) and the client (5173); both serve the website at `/`
(5173 proxies `/api` to the API for the forms).
