import { useCallback, useEffect, useState } from 'react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import {
  Plus, Users2, ShieldCheck, KeyRound, CheckCircle2, Clock, Lock, Layers, Eye, Pencil, Trash2,
} from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { InviteUserModal } from '../../components/users/InviteUserModal.jsx';
import { UserCard } from '../../components/users/UserCard.jsx';
import { UserProfileModal } from '../../components/users/UserProfileModal.jsx';
import { RoleFormModal } from '../../components/roles/RoleFormModal.jsx';
import { PermissionFormModal } from '../../components/roles/PermissionFormModal.jsx';
import { usersApi } from '../../api/users.js';
import { rolesApi } from '../../api/roles.js';
import { permissionsApi } from '../../api/permissions.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_USERS, CAN_MANAGE_ROLES, CAN_INVITE_USERS, CAN_DELETE_USERS, canAny } from '../../config/capabilities.js';

const USER_STATUS_LIST = ['active', 'pending', 'locked'];

function UsersTab({ canManage }) {
  const { user: me } = useAuth();
  const canInvite = canAny(me?.roles ?? [], CAN_INVITE_USERS);
  const canDelete = canAny(me?.roles ?? [], CAN_DELETE_USERS);
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [profileUser, setProfileUser] = useState(null);
  const statusCounts = useStatusCounts(usersApi.list, USER_STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    usersApi.list({ page, pageSize: 20, search: search || undefined, status: status || undefined })
      .then((res) => { setUsers(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, search, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { rolesApi.list().then((res) => setRoles(res.data)).catch(() => {}); }, []);

  const onSearchSubmit = (e) => { e.preventDefault(); setPage(1); load(); };

  const handleUserChanged = (updated) => {
    setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    setProfileUser(updated);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Users2}
        eyebrow="User Management"
        title="Users"
        description="Manage system users, account access, roles and activity from one place."
        action={canInvite && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Invite user
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Users2} label="Total Users" value={statusCounts?.total ?? '—'} subtext="Registered accounts" tone="brand" />
        <StatCard icon={CheckCircle2} label="Active Users" value={statusCounts?.active ?? '—'} subtext="Currently active" tone="success" />
        <StatCard icon={Clock} label="Pending Users" value={statusCounts?.pending ?? '—'} subtext="Awaiting approval" tone="warning" />
        <StatCard icon={Lock} label="Locked Users" value={statusCounts?.locked ?? '—'} subtext="Access suspended" tone="danger" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <form onSubmit={onSearchSubmit} className="flex-1">
            <Field label="Search" placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </form>
          <SelectField label="Status" className="sm:w-48" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="locked">Locked</option>
          </SelectField>
          <Button variant="secondary" onClick={onSearchSubmit}>Search</Button>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading users…" /></Card>
      ) : users.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Users2 size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No users found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {users.map((u) => (
              <UserCard key={u.id} user={u} isSelf={u.id === me?.id} onView={() => setProfileUser(u)} />
            ))}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <InviteUserModal open={inviteOpen} onClose={() => setInviteOpen(false)} onSaved={load} />
      <UserProfileModal
        open={Boolean(profileUser)}
        onClose={() => setProfileUser(null)}
        user={profileUser}
        roles={roles}
        canManage={canManage}
        canDelete={canDelete}
        isSelf={profileUser?.id === me?.id}
        onChanged={handleUserChanged}
        onDeleted={() => { setProfileUser(null); load(); }}
      />
    </div>
  );
}

function RolesTab({ canManage, permissions }) {
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [deleteRole, setDeleteRole] = useState(null);

  const load = useCallback(() => {
    rolesApi.list().then((res) => setRoles(res.data)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const systemCount = roles?.filter((r) => r.isSystem).length ?? 0;
  const customCount = roles ? roles.length - systemCount : 0;
  const q = search.trim().toLowerCase();
  const visibleRoles = roles?.filter((r) => !q || r.name.toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ShieldCheck}
        eyebrow="Access Control"
        title="Roles"
        description="What each role in your organization can do."
        action={canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New role
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Total Roles" value={roles?.length ?? '—'} subtext="All roles" tone="brand" />
        <StatCard icon={Lock} label="System Roles" value={systemCount || '—'} subtext="Built-in" tone="neutral" />
        <StatCard icon={Users2} label="Custom Roles" value={roles ? customCount : '—'} subtext="Created by admins" tone="success" />
        <StatCard icon={KeyRound} label="Total Permissions" value={permissions?.length ?? '—'} subtext="In the catalog" tone="warning" />
      </div>

      <Card>
        <CardBody>
          <Field label="Search" placeholder="Search roles by name or description…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {!roles ? (
          <LoadingState label="Loading roles…" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Role</Th>
                <Th>Description</Th>
                <Th>Type</Th>
                <Th>Permissions</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {visibleRoles.map((role) => (
                <Tr key={role.id}>
                  <Td className="font-medium capitalize text-slate-900 dark:text-slate-100">{role.name.replace(/_/g, ' ')}</Td>
                  <Td nowrap={false} className="text-slate-500 dark:text-slate-400">{role.description || '—'}</Td>
                  <Td><Badge tone={role.isSystem ? 'neutral' : 'success'}>{role.isSystem ? 'System' : 'Custom'}</Badge></Td>
                  <Td><Badge tone="brand">{role.permissions.length}</Badge></Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1.5">
                      <Link to={`/roles/${role.id}`}>
                        <Button variant="secondary" size="sm" aria-label={`View ${role.name} role`} title="View role">
                          <Eye size={14} aria-hidden="true" />
                        </Button>
                      </Link>
                      {canManage && (
                        <Button variant="secondary" size="sm" onClick={() => setEditRole(role)} aria-label={`Edit ${role.name} role`} title="Edit role">
                          <Pencil size={14} aria-hidden="true" />
                        </Button>
                      )}
                      {canManage && !role.isSystem && (
                        <Button variant="danger" size="sm" onClick={() => setDeleteRole(role)} aria-label={`Delete ${role.name} role`} title="Delete role">
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
              {visibleRoles.length === 0 && (
                <Tr><Td colSpan={5} className="py-8 text-center text-slate-400">No roles match your search.</Td></Tr>
              )}
            </Tbody>
          </Table>
        )}
      </Card>

      <RoleFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
      <RoleFormModal open={Boolean(editRole)} onClose={() => setEditRole(null)} onSaved={load} role={editRole} />
      <ConfirmDialog
        open={Boolean(deleteRole)}
        onClose={() => setDeleteRole(null)}
        onConfirm={async () => { await rolesApi.remove(deleteRole.id); load(); }}
        title="Delete role?"
        description={deleteRole ? `Delete the "${deleteRole.name.replace(/_/g, ' ')}" role. This only works if no users currently hold it.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}

function PermissionsTab({ canManage, permissions, loading, error, onCreated }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editPermission, setEditPermission] = useState(null);
  const [deletePermission, setDeletePermission] = useState(null);
  const resourceCount = permissions ? new Set(permissions.map((p) => p.name.split(':')[0])).size : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={KeyRound}
        eyebrow="Access Control"
        title="Permissions"
        description="The full catalog of permissions that can be assigned to roles."
        action={canManage && (
          <Button onClick={() => setFormOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New permission
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard icon={KeyRound} label="Total Permissions" value={permissions?.length ?? '—'} subtext="In the catalog" tone="brand" />
        <StatCard icon={Layers} label="Resources Covered" value={resourceCount || '—'} subtext="Distinct resource areas" tone="success" />
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingState label="Loading permissions…" />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Type</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {permissions?.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-mono text-xs text-slate-700 dark:text-slate-300">{p.name}</Td>
                  <Td nowrap={false} className="text-slate-500 dark:text-slate-400">{p.description || '—'}</Td>
                  <Td><Badge tone={p.isSystem ? 'neutral' : 'success'}>{p.isSystem ? 'System' : 'Custom'}</Badge></Td>
                  <Td>
                    {canManage && !p.isSystem ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <Button variant="secondary" size="sm" onClick={() => setEditPermission(p)} aria-label={`Edit ${p.name} permission`} title="Edit permission">
                          <Pencil size={14} aria-hidden="true" />
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeletePermission(p)} aria-label={`Delete ${p.name} permission`} title="Delete permission">
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <span className="flex justify-end text-xs text-slate-400">Built-in</span>
                    )}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </Card>

      <PermissionFormModal open={formOpen} onClose={() => setFormOpen(false)} onSaved={onCreated} />
      <PermissionFormModal open={Boolean(editPermission)} onClose={() => setEditPermission(null)} onSaved={onCreated} permission={editPermission} />
      <ConfirmDialog
        open={Boolean(deletePermission)}
        onClose={() => setDeletePermission(null)}
        onConfirm={async () => { await permissionsApi.remove(deletePermission.id); onCreated(); }}
        title="Delete permission?"
        description={deletePermission ? `Delete "${deletePermission.name}". This only works if no roles currently use it.` : ''}
        confirmLabel="Delete"
      />
    </div>
  );
}

const TABS = [
  { id: 'users', label: 'Users', icon: Users2 },
  { id: 'roles', label: 'Roles', icon: ShieldCheck },
  { id: 'permissions', label: 'Permissions', icon: KeyRound },
];

export default function UsersRolesPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManageUsers = canAny(roles, CAN_MANAGE_USERS);
  const canManageRoles = canAny(roles, CAN_MANAGE_ROLES);
  const [tab, setTab] = useState('users');

  const [permissions, setPermissions] = useState(null);
  const [permissionsError, setPermissionsError] = useState(null);
  const [permissionsLoading, setPermissionsLoading] = useState(true);

  const loadPermissions = useCallback(() => {
    setPermissionsLoading(true);
    setPermissionsError(null);
    permissionsApi.list()
      .then((res) => setPermissions(res.data))
      .catch((err) => setPermissionsError(err.message))
      .finally(() => setPermissionsLoading(false));
  }, []);

  useEffect(() => { loadPermissions(); }, [loadPermissions]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            <t.icon size={15} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'users' && <UsersTab canManage={canManageUsers} />}
      {tab === 'roles' && <RolesTab canManage={canManageRoles} permissions={permissions} />}
      {tab === 'permissions' && (
        <PermissionsTab canManage={canManageRoles} permissions={permissions} loading={permissionsLoading} error={permissionsError} onCreated={loadPermissions} />
      )}
    </div>
  );
}
