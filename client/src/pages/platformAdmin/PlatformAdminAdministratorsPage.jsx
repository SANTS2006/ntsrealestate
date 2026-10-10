import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Users, UserPlus, UserX, UserCheck, Trash2 } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { usePlatformAdmin } from '../../contexts/PlatformAdminContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi } from '../../api/platformAdmin.js';

const schema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.'),
  lastName: z.string().trim().min(1, 'Enter a last name.'),
  email: z.string().trim().min(1, 'Enter an email.').email('Enter a valid email address.'),
});

function AddAdminModal({ open, onClose, onAdded }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const close = () => {
    reset();
    setServerError(null);
    onClose();
  };

  const onSubmit = async (body) => {
    setServerError(null);
    try {
      const res = await platformAdminApi.createAdmin(body);
      onAdded(res.data);
      close();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add platform admin" description="They get an email with a link to set their own password." size="md">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" placeholder="Enter first name" autoFocus error={errors.firstName?.message} {...register('firstName')} />
          <Field label="Last name" placeholder="Enter last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Field label="Email address" type="email" placeholder="Enter their email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" loading={isSubmitting} className="w-full">Send invitation</Button>
      </form>
    </Modal>
  );
}

export default function PlatformAdminAdministratorsPage() {
  useDocumentTitle('Administrators — Platform Admin');
  const { admin: me } = usePlatformAdmin();
  const [admins, setAdmins] = useState(null);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [added, setAdded] = useState(null);
  const [pending, setPending] = useState(null); // { admin, nextActive }
  const [pendingDelete, setPendingDelete] = useState(null);

  const load = useCallback(() => {
    setError(null);
    platformAdminApi.listAdmins()
      .then((res) => setAdmins(res.data))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  const confirm = async () => {
    if (!pending) return;
    try {
      await platformAdminApi.setAdminActive(pending.admin.id, pending.nextActive);
    } catch (err) {
      setError(err.message);
    }
    load();
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await platformAdminApi.deleteAdmin(pendingDelete.id);
    } catch (err) {
      setError(err.message);
    }
    load();
  };

  return (
    <>
      <PageHeader
        icon={Users}
        eyebrow="Platform"
        title="Administrators"
        description="The people who can create and manage organizations on the platform."
        action={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />
            Add administrator
          </Button>
        }
      />

      {added && <Alert variant="success" className="mt-6">{added.firstName} {added.lastName} was invited at {added.email}.</Alert>}
      {error && <Alert variant="error" className="mt-6">{error}</Alert>}

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {!admins && !error && <div className="p-8"><LoadingState label="Loading administrators…" /></div>}
        {admins && (
          <>
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {admins.map((a) => (
              <li key={a.id} className="flex flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {a.firstName} {a.lastName}
                      {a.id === me?.id && <span className="ml-2 text-xs font-normal text-slate-500 dark:text-slate-400">(you)</span>}
                    </p>
                    <p className="truncate text-sm text-slate-500 dark:text-slate-400">{a.email}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone={a.isActive ? 'success' : 'danger'}>{a.isActive ? 'Active' : 'Deactivated'}</Badge>
                    {a.isDefault && <Badge tone="brand">Default</Badge>}
                  </div>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Last sign-in: {a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : 'Never'}</p>
                {a.id !== me?.id && (
                  <div className="flex gap-2">
                    {a.isActive ? (
                      <Button variant="danger" size="sm" className="flex-1" onClick={() => setPending({ admin: a, nextActive: false })}><UserX size={14} aria-hidden="true" />Deactivate</Button>
                    ) : (
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => setPending({ admin: a, nextActive: true })}><UserCheck size={14} aria-hidden="true" />Reactivate</Button>
                    )}
                    {!a.isDefault && (
                      <Button variant="danger" size="sm" className="flex-1" onClick={() => setPendingDelete(a)}><Trash2 size={14} aria-hidden="true" />Delete</Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Status</Th>
                <Th>Last sign-in</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </Thead>
            <Tbody>
              {admins.map((a) => (
                <Tr key={a.id}>
                  <Td>
                    <span className="font-medium text-slate-900 dark:text-slate-100">{a.firstName} {a.lastName}</span>
                    {a.id === me?.id && <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">(you)</span>}
                    {a.isDefault && <Badge tone="brand" className="ml-2">Default</Badge>}
                  </Td>
                  <Td>{a.email}</Td>
                  <Td><Badge tone={a.isActive ? 'success' : 'danger'}>{a.isActive ? 'Active' : 'Deactivated'}</Badge></Td>
                  <Td>{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString() : 'Never'}</Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                    {a.id !== me?.id && (a.isActive ? (
                      <Button variant="danger" size="sm" onClick={() => setPending({ admin: a, nextActive: false })}>
                        <UserX size={14} aria-hidden="true" />
                        Deactivate
                      </Button>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => setPending({ admin: a, nextActive: true })}>
                        <UserCheck size={14} aria-hidden="true" />
                        Reactivate
                      </Button>
                    ))}
                    {a.id !== me?.id && !a.isDefault && (
                      <Button variant="danger" size="sm" onClick={() => setPendingDelete(a)} aria-label={`Delete ${a.firstName} ${a.lastName}`}>
                        <Trash2 size={14} aria-hidden="true" />
                        Delete
                      </Button>
                    )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          </div>
          </>
        )}
      </div>

      <AddAdminModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={(a) => { setAdded(a); load(); }} />

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={confirm}
        title={pending?.nextActive ? 'Reactivate administrator?' : 'Deactivate administrator?'}
        description={
          pending?.nextActive
            ? `${pending?.admin.firstName} ${pending?.admin.lastName} will be able to sign in again.`
            : `${pending?.admin.firstName} ${pending?.admin.lastName} will be signed out and unable to sign in until you reactivate them.`
        }
        confirmLabel={pending?.nextActive ? 'Reactivate' : 'Deactivate'}
        variant={pending?.nextActive ? 'primary' : 'danger'}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        title="Delete administrator?"
        description={`${pendingDelete?.firstName} ${pendingDelete?.lastName} (${pendingDelete?.email}) will be permanently removed and signed out everywhere. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
