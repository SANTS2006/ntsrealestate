import { useState } from 'react';
import { LogOut, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Alert } from '../ui/Alert.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { UserAvatar } from '../ui/UserAvatar.jsx';
import { usersApi } from '../../api/users.js';
import { hasPermission } from '../../config/capabilities.js';

const STATUS_TONE = { pending: 'warning', active: 'success', inactive: 'neutral', locked: 'danger' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export function UserProfileModal({ open, onClose, user, roles, canManage, canDelete = false, isSelf, onChanged, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [roleError, setRoleError] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!user) return null;

  const handleRoleChange = async (role, remove = false) => {
    if (!role) return;
    setRoleError(null);
    setBusy(true);
    try {
      const updated = remove ? await usersApi.removeRole(user.id, role) : await usersApi.addRole(user.id, role);
      onChanged(updated.data);
    } catch (err) {
      setRoleError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async () => {
    setStatusError(null);
    setBusy(true);
    try {
      const updated = await usersApi.updateStatus(user.id, user.status === 'active' ? 'inactive' : 'active');
      onChanged(updated.data);
    } catch (err) {
      setStatusError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setDeleteError(null);
    try {
      await usersApi.remove(user.id);
      onDeleted?.(user);
      onClose();
    } catch (err) {
      setDeleteError(err.message);
      throw err;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="User profile">
      <div className="flex items-center gap-4">
        <UserAvatar user={user} size={64} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-lg font-semibold text-slate-900 dark:text-slate-100">{user.firstName} {user.lastName}</p>
            <Badge tone={STATUS_TONE[user.status] ?? 'neutral'}>{user.status}</Badge>
          </div>
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Phone</dt>
          <dd className="text-slate-900 dark:text-slate-100">{user.phone ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Email verified</dt>
          <dd className="text-slate-900 dark:text-slate-100">{user.emailVerified ? 'Yes' : 'No'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">MFA</dt>
          <dd className="text-slate-900 dark:text-slate-100">{user.mfaEnabled ? 'Enabled' : 'Disabled'}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Last login</dt>
          <dd className="text-slate-900 dark:text-slate-100">{user.lastLoginAt ? dateFmt.format(new Date(user.lastLoginAt)) : 'Never'}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-slate-500 dark:text-slate-400">Created</dt>
          <dd className="text-slate-900 dark:text-slate-100">{dateFmt.format(new Date(user.createdAt))}</dd>
        </div>
      </dl>

      {canManage && !isSelf && (
        <div className="mt-6 flex flex-col gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          {hasPermission('users:change-role') && (
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Roles</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(user.roles ?? []).map((r) => (
                <span key={r} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium capitalize text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">
                  {r.replace(/_/g, ' ')}
                  {(user.roles ?? []).length > 1 && (
                    <button type="button" disabled={busy} onClick={() => handleRoleChange(r, true)} aria-label={`Remove role ${r.replace(/_/g, ' ')}`} className="ml-0.5 rounded-full px-1 text-brand-500 hover:bg-brand-100 hover:text-brand-800 disabled:opacity-50 dark:hover:bg-brand-900">×</button>
                  )}
                </span>
              ))}
            </div>
            <label className="mt-3 block text-xs text-slate-500 dark:text-slate-400" htmlFor="user-role-select">Add another role — they can then switch between roles from the top bar</label>
            <select
              id="user-role-select"
              value=""
              onChange={(e) => handleRoleChange(e.target.value)}
              disabled={busy}
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              <option value="">Add a role…</option>
              {roles.filter((r) => !(user.roles ?? []).includes(r.name)).map((r) => <option key={r.id} value={r.name}>{r.name.replace(/_/g, ' ')}</option>)}
            </select>
            {roleError && <Alert variant="error" className="mt-2">{roleError}</Alert>}
          </div>
          )}

          {['active', 'inactive', 'locked'].includes(user.status) && (
            <div>
              {statusError && <Alert variant="error" className="mb-2">{statusError}</Alert>}
              <Button variant={user.status === 'active' ? 'danger' : 'primary'} onClick={toggleStatus} loading={busy} className="w-full">
                <LogOut size={15} aria-hidden="true" />
                {user.status === 'active' ? 'Deactivate account' : 'Activate account'}
              </Button>
            </div>
          )}

          {canDelete && (
            <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
              {deleteError && <Alert variant="error" className="mb-2">{deleteError}</Alert>}
              <Button variant="danger" onClick={() => setConfirmDelete(true)} className="w-full">
                <Trash2 size={15} aria-hidden="true" />
                Delete user permanently
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Delete this user permanently?"
        description={`${user.firstName} ${user.lastName} and everything tied to them will be erased from the system and the database — their login, profile, messages, and any tenant or owner records, leases, invoices and payments. This cannot be undone.`}
        confirmLabel="Delete permanently"
        variant="danger"
      />

      <div className="mt-6 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
      </div>
    </Modal>
  );
}
