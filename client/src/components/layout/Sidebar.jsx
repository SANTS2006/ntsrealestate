import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronDown, X } from 'lucide-react';
import clsx from 'clsx';
import { NAV_SECTIONS, isNavItemVisible, visibleChildren } from '../../config/navigation.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useBranding } from '../../contexts/BrandingContext.jsx';
import { useOptionalChat } from '../../contexts/ChatContext.jsx';
import { Logo } from '../ui/Logo.jsx';

function NavItemLink({ to, children, onNavigate }) {
  return (
    <NavLink
      to={to}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'block rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-400'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        )
      }
    >
      {children}
    </NavLink>
  );
}

function NavGroup({ item, children, onNavigate }) {
  const [open, setOpen] = useState(true);
  const Icon = item.icon;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Icon size={17} aria-hidden="true" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown size={15} className={clsx('transition-transform duration-300 ease-in-out', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {/* Grid-rows trick animates height from/to auto without measuring it in JS. */}
      <div className={clsx('grid transition-[grid-template-rows] duration-300 ease-in-out', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="overflow-hidden">
          <div
            className={clsx(
              'ml-4 mt-1 flex flex-col gap-0.5 border-l border-slate-200 pl-4 transition-opacity duration-200 dark:border-slate-800',
              open ? 'opacity-100 delay-100' : 'opacity-0'
            )}
          >
            {children.map((child) => (
              <NavItemLink key={child.to} to={child.to} onNavigate={onNavigate}>
                {child.label}
              </NavItemLink>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrandHeader({ onClose }) {
  const { branding } = useBranding();
  return (
    <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 dark:border-slate-800">
      <div className="flex min-w-0 items-center gap-2">
        <Logo size={28} />
        <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{branding.name}</span>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function Sidebar({ mobileOpen, onClose }) {
  const { user } = useAuth();
  const chat = useOptionalChat();
  const unreadChat = chat?.totalUnread ?? 0;
  const roles = user?.roles ?? [];
  const visibleSections = NAV_SECTIONS.filter((item) => isNavItemVisible(item, roles));

  const nav = (onNavigate) => (
    <nav aria-label="Primary" className="custom-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
      {visibleSections.map((item) =>
        item.children ? (
          <NavGroup key={item.label} item={item} children={visibleChildren(item, roles)} onNavigate={onNavigate} />
        ) : (
          <NavItemLink key={item.to} to={item.to} onNavigate={onNavigate}>
            <span className="flex items-center gap-2.5">
              <item.icon size={17} aria-hidden="true" />
              {item.label}
              {item.to === '/chat' && unreadChat > 0 && (
                <span className="ml-auto rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-semibold text-white" aria-label={`${unreadChat} unread`}>{unreadChat > 99 ? '99+' : unreadChat}</span>
              )}
            </span>
          </NavItemLink>
        )
      )}
    </nav>
  );

  return (
    <>
      {/* Desktop: fixed sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <BrandHeader />
        {nav()}
      </aside>

      {/* Mobile: slide-over drawer — always mounted (rather than conditionally
          rendered) so the transform/opacity transitions can play on both the
          way in and the way out; pointer-events-none keeps it non-interactive
          and invisible to a11y tools while off-screen. */}
      <div className={clsx('fixed inset-0 z-40 lg:hidden', !mobileOpen && 'pointer-events-none')} aria-hidden={!mobileOpen}>
        <div
          className={clsx(
            'absolute inset-0 bg-slate-950/50 transition-opacity duration-300 ease-in-out',
            mobileOpen ? 'opacity-100' : 'opacity-0'
          )}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={clsx(
            'absolute inset-y-0 left-0 flex w-64 flex-col bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-slate-900',
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <BrandHeader onClose={onClose} />
          {nav(onClose)}
        </div>
      </div>
    </>
  );
}
