import { Logo } from '../ui/Logo.jsx';
import { useBranding } from '../../contexts/BrandingContext.jsx';

export function Footer() {
  const { branding } = useBranding();
  return (
    <footer className="mt-auto shrink-0 border-t border-slate-200 bg-white/60 px-4 py-3 text-xs text-slate-500 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 sm:px-6">
      <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <div className="flex items-center gap-2">
          <Logo size={18} />
          <span>&copy; {new Date().getFullYear()} {branding.name}. All rights reserved.</span>
        </div>
        <span>Built by NTS Digital Solutions</span>
      </div>
    </footer>
  );
}
