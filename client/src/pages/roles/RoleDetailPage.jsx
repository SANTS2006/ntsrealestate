import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, KeyRound, Users2, Pencil, Trash2, CheckSquare, Square } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { BackLink, DetailHeader } from '../../components/ui/Detail.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { RoleFormModal } from '../../components/roles/RoleFormModal.jsx';
import { rolesApi } from '../../api/roles.js';
import { permissionsApi } from '../../api/permissions.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CAN_MANAGE_ROLES, canAny } from '../../config/capabilities.js';

const FILTERS = [
  { value: 'all', label: 'All permissions' },
  { value: 'assigned', label: 'Assigned only' },
  { value: 'unassigned', label: 'Unassigned only' },
];

export default function RoleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManage = canAny(user?.roles ?? [], CAN_MANAGE_ROLES);

  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    rolesApi.get(id).then((res) => setRole(res.data)).catch((err) => setError(err.message));
    permissionsApi.list().then((res) => setPermissions(res.data)).catch((err) => setError(err.message));
  }, [id]);

  const reloadRole = useCallback(() => {
    rolesApi.get(id).then((res) => setRole(res.data)).catch((err) => setError(err.message));
  }, [id]);

  const isAdministrator = role?.name === 'administrator';
  const assignedNames = useMemo(() => new Set(role?.permissions ?? []), [role]);

  const filteredPermissions = useMemo(() => {
    if (!permissions) return [];
    const q = search.trim().toLowerCase();
    return permissions.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !(p.description ?? '').toLowerCase().includes(q)) return false;
      const isAssigned = assignedNames.has(p.name);
      if (filter === 'assigned' && !isAssigned) return false;
      if (filter === 'unassigned' && isAssigned) return false;
      return true;
    });
  }, [permissions, search, filter, assignedNames]);

  const toggle = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const allVisibleSelected = filteredPermissions.length > 0 && filteredPermissions.every((p) => selected.has(p.name));
  const toggleAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const p of filteredPermissions) next.delete(p.name);
      } else {
        for (const p of filteredPermissions) next.add(p.name);
      }
      return next;
    });
  };

  const selectedUnassignedCount = [...selected].filter((n) => !assignedNames.has(n)).length;
  const selectedAssignedCount = [...selected].filter((n) => assignedNames.has(n)).length;

  const runSave = async (nextNames) => {
    setActionError(null);
    setSaving(true);
    try {
      const res = await rolesApi.setPermissions(id, nextNames);
      setRole(res.data);
      setSelected(new Set());
    } catch (err) {
      setActionError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setSaving(false);
    }
  };

  const assignSelected = () => runSave([...new Set([...assignedNames, ...selected])]);
  const removeSelected = () => runSave([...assignedNames].filter((n) => !selected.has(n)));

  if (error && !role) return <Alert variant="error">{error}</Alert>;
  if (!role || !permissions) return <LoadingState label="Loading role…" />;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink to="/users">Back to roles</BackLink>

      {error && <Alert variant="error">{error}</Alert>}
      {actionError && <Alert variant="error">{actionError}</Alert>}

      <DetailHeader
        icon={ShieldCheck}
        title={<span className="capitalize">{role.name.replace(/_/g, ' ')}</span>}
        badges={<Badge tone={role.isSystem ? 'neutral' : 'success'}>{role.isSystem ? 'System' : 'Custom'}</Badge>}
        subtitle={role.description || 'No description provided.'}
        actions={canManage && (
          <>
            <Button variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil size={14} aria-hidden="true" />
              Edit role
            </Button>
            {!role.isSystem && (
              <Button variant="danger" onClick={() => setDeleteOpen(true)}>
                <Trash2 size={14} aria-hidden="true" />
                Delete
              </Button>
            )}
          </>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard icon={ShieldCheck} label="Assigned Permissions" value={role.permissions.length} subtext="Granted to this role" tone="brand" />
        <StatCard icon={KeyRound} label="Available Permissions" value={permissions.length} subtext="In the catalog" tone="warning" />
        <StatCard icon={Users2} label="Users With This Role" value={role.userCount ?? 0} subtext="Currently assigned" tone="success" />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Permissions</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">Search, filter, and select multiple permissions to assign or remove.</p>
        </CardHeader>
        <CardBody className="flex flex-col gap-4">
          {isAdministrator && <Alert variant="info">The administrator role always keeps full access and can't be customized.</Alert>}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field
              label="Search"
              placeholder="Search by permission name or description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <SelectField label="Filter" className="sm:w-52" value={filter} onChange={(e) => setFilter(e.target.value)}>
              {FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
            </SelectField>
          </div>

          {canManage && !isAdministrator && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{selected.size} selected</span>
              <Button size="sm" onClick={assignSelected} disabled={selectedUnassignedCount === 0} loading={saving}>Assign selected</Button>
              <Button size="sm" variant="danger" onClick={removeSelected} disabled={selectedAssignedCount === 0} loading={saving}>Remove selected</Button>
            </div>
          )}

          <Table>
            <Thead>
              <Tr>
                {canManage && !isAdministrator && (
                  <Th className="w-10">
                    <button type="button" onClick={toggleAllVisible} aria-label="Select all visible permissions" className="flex items-center text-slate-400 hover:text-brand-600 dark:hover:text-brand-400">
                      {allVisibleSelected ? <CheckSquare size={16} aria-hidden="true" /> : <Square size={16} aria-hidden="true" />}
                    </button>
                  </Th>
                )}
                <Th>Name</Th>
                <Th>Description</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredPermissions.map((p) => {
                const isAssigned = assignedNames.has(p.name);
                return (
                  <Tr key={p.id}>
                    {canManage && !isAdministrator && (
                      <Td>
                        <input
                          type="checkbox"
                          checked={selected.has(p.name)}
                          onChange={() => toggle(p.name)}
                          aria-label={`Select ${p.name}`}
                          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                        />
                      </Td>
                    )}
                    <Td className="font-mono text-xs text-slate-700 dark:text-slate-300">{p.name}</Td>
                    <Td nowrap={false} className="text-slate-500 dark:text-slate-400">{p.description || '—'}</Td>
                    <Td>
                      <Badge tone={isAssigned ? 'success' : 'neutral'}>{isAssigned ? 'Assigned' : 'Unassigned'}</Badge>
                    </Td>
                  </Tr>
                );
              })}
              {filteredPermissions.length === 0 && (
                <Tr>
                  <Td colSpan={canManage && !isAdministrator ? 4 : 3} className="py-8 text-center text-slate-400">No permissions match your search.</Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      <RoleFormModal open={editOpen} onClose={() => setEditOpen(false)} onSaved={reloadRole} role={role} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => { await rolesApi.remove(id); navigate('/users', { replace: true }); }}
        title="Delete role?"
        description={`Delete the "${role.name.replace(/_/g, ' ')}" role. This only works if no users currently hold it.`}
        confirmLabel="Delete"
      />
    </div>
  );
}
