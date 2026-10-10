import { Globe } from 'lucide-react';
import clsx from 'clsx';
import { PUBLIC_SITE_URL } from '../../config/env.js';

// Opens the company website in a new tab, so people can go there and come
// back to the app without signing out and in again (the website is public).
export function WebsiteLink({ className, showLabel = true }) {
  return (
    <a
      href={PUBLIC_SITE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Open the company website"
      aria-label="Open the company website (opens in a new tab)"
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
        className,
      )}
    >
      <Globe size={17} aria-hidden="true" />
      {showLabel && <span className="hidden sm:inline">Website</span>}
    </a>
  );
}
