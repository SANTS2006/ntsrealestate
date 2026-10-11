import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { API_URL } from '../../config/env.js';

// A platform admin's picture, or their initials on a gradient badge when they
// have none (or it fails to load). `admin.avatarUpdatedAt` busts the cache
// whenever the picture changes.
export function AdminAvatar({ admin, size = 36, className }) {
  const [failed, setFailed] = useState(false);
  const version = admin?.avatarUpdatedAt;
  useEffect(() => setFailed(false), [version, admin?.id]);
  const initials = `${admin?.firstName?.[0] ?? ''}${admin?.lastName?.[0] ?? ''}`.toUpperCase();

  if (admin?.id && version && !failed) {
    return (
      <img
        src={`${API_URL}/platform-admin/admins/${admin.id}/avatar?v=${encodeURIComponent(version)}`}
        alt={`${admin.firstName} ${admin.lastName}`}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        className={clsx('shrink-0 rounded-full object-cover', className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span className={clsx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-600 to-accent-600 font-semibold text-white', className)} style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}>
      {initials}
    </span>
  );
}
