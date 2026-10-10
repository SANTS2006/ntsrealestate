import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { documentsApi } from '../../api/documents.js';

function initialsOf(user) {
  if (!user) return '';
  return `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase();
}

// Shows the user's most recently uploaded profile photo (a Document with
// entityType='user', entityId=their own id), falling back to initials on a
// gradient badge if none exists yet or the image fails to load. Refetches
// whenever `refreshKey` changes, so the Settings page can force an update
// right after a new photo is uploaded.
export function UserAvatar({ user, size = 32, refreshKey, className }) {
  const [photoUrl, setPhotoUrl] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    documentsApi.list('user', user.id, { pageSize: 1 })
      .then((res) => {
        if (cancelled) return;
        const latest = res.data[0];
        if (!latest || !latest.mimeType?.startsWith('image/')) { setPhotoUrl(null); return; }
        return documentsApi.getAccessUrl(latest.id).then((r) => { if (!cancelled) setPhotoUrl(r.data.url); });
      })
      .catch(() => { if (!cancelled) setPhotoUrl(null); });
    return () => { cancelled = true; };
  }, [user?.id, refreshKey]);

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={`${user.firstName} ${user.lastName}`}
        width={size}
        height={size}
        className={clsx('shrink-0 rounded-full object-cover', className)}
        style={{ width: size, height: size }}
        onError={() => setPhotoUrl(null)}
      />
    );
  }

  return (
    <span
      className={clsx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 font-semibold text-white', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {initialsOf(user)}
    </span>
  );
}
