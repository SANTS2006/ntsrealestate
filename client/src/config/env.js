export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

// The public marketing/listings site — home of the Terms & Conditions,
// Privacy Policy, and Contact pages this app links out to (this app has no
// legal or marketing pages of its own; that content lives in one place).
export const PUBLIC_SITE_URL = import.meta.env.VITE_PUBLIC_SITE_URL || 'https://surprise-realty-listings.vercel.app';

// Only this company has a public website of its own (the listings site). Its
// link appears for its people only, not for companies added later.
export const WEBSITE_ORG_SLUG = import.meta.env.VITE_WEBSITE_ORG_SLUG || 'surpriserealestate';
