import { useEffect, useState } from 'react';
import { Eye, ShieldCheck, BadgeCheck, Clock, Calendar } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { documentsApi } from '../../api/documents.js';

const STATUS_TONE = { pending: 'warning', active: 'success', inactive: 'neutral', locked: 'danger' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

function initialsOf(user) {
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
}

// Same visual shape as EntityCard (photo/initials, status badge, info grid,
// action button) but with its own avatar resolution — a user's photo is a
// live-fetched signed URL (same pattern as UserAvatar.jsx) rather than a
// pre-resolved coverImageUrl the list endpoint already batches for other
// entities, so it doesn't fit EntityCard's plain `imageUrl` prop cleanly.
export function UserCard({ user, isSelf, onView }) {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    documentsApi.list('user', user.id, { pageSize: 1 })
      .then((res) => {
        if (cancelled) return;
        const latest = res.data[0];
        if (!latest || !latest.mimeType?.startsWith('image/')) return;
        return documentsApi.getAccessUrl(latest.id).then((r) => { if (!cancelled) setPhotoUrl(r.data.url); });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user.id]);

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {photoUrl ? (
          <img src={photoUrl} alt={`${user.firstName} ${user.lastName}`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 text-xl font-semibold text-white">
              {initialsOf(user)}
            </span>
          </div>
        )}
        <Badge tone={STATUS_TONE[user.status] ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">{user.status}</Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
            {user.firstName} {user.lastName}{isSelf && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
          </p>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"><ShieldCheck size={11} className="shrink-0" aria-hidden="true" />Role</p>
            <p className="mt-0.5 truncate text-sm font-medium capitalize text-slate-900 dark:text-slate-100">{(user.roles ?? []).join(', ').replace(/_/g, ' ') || 'No role'}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"><BadgeCheck size={11} className="shrink-0" aria-hidden="true" />Account</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.emailVerified ? 'Verified' : 'Unverified'}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"><Clock size={11} className="shrink-0" aria-hidden="true" />Last login</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{user.lastLoginAt ? dateFmt.format(new Date(user.lastLoginAt)) : 'Never'}</p>
          </div>
          <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-800/50">
            <p className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400"><Calendar size={11} className="shrink-0" aria-hidden="true" />Created</p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-900 dark:text-slate-100">{dateFmt.format(new Date(user.createdAt))}</p>
          </div>
        </div>

        <Button type="button" onClick={onView} className="mt-auto">
          <Eye size={14} aria-hidden="true" />
          View profile
        </Button>
      </div>
    </div>
  );
}
