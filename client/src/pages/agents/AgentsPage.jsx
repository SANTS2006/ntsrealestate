import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Briefcase, UserPlus, Pencil, Trash2, Power, Mail, Phone } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { agentsApi } from '../../api/agents.js';
import { ownersApi } from '../../api/owners.js';
import { CAN_MANAGE_AGENTS, canAny } from '../../config/capabilities.js';

const addSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.'),
  lastName: z.string().trim().min(1, 'Enter a last name.'),
  email: z.string().trim().min(1, 'Enter an email.').email('Enter a valid email address.'),
  ownerId: z.string().optional(),
});
const editSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter a first name.'),
  lastName: z.string().trim().min(1, 'Enter a last name.'),
  phone: z.string().trim().max(40).optional(),
});

function AddAgentModal({ open, onClose, onSaved, isAdmin, owners }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(addSchema) });

  const close = () => { reset(); setServerError(null); onClose(); };
  const onSubmit = async (body) => {
    setServerError(null);
    if (isAdmin && !body.ownerId) { setServerError('Choose which owner this agent works for.'); return; }
    try {
      await agentsApi.add({ ...body, ownerId: isAdmin ? body.ownerId : undefined });
      onSaved();
      close();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add agent" description="New agents get an email to set their password. If the email already belongs to one of your agents, they are linked instead." size="md">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        {isAdmin && (
          <SelectField label="Owner" error={errors.ownerId?.message} {...register('ownerId')}>
            <option value="">Select an owner…</option>
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </SelectField>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" autoFocus error={errors.firstName?.message} {...register('firstName')} />
          <Field label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Field label="Email address" type="email" error={errors.email?.message} {...register('email')} />
        <Button type="submit" loading={isSubmitting} className="w-full">Add agent</Button>
      </form>
    </Modal>
  );
}

function EditAgentModal({ link, onClose, onSaved }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    if (link) reset({ firstName: link.agent.firstName, lastName: link.agent.lastName, phone: link.agent.phone ?? '' });
  }, [link, reset]);

  const onSubmit = async (body) => {
    setServerError(null);
    try {
      await agentsApi.update(link.linkId, { ...body, phone: body.phone || null });
      onSaved();
      onClose();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={Boolean(link)} onClose={onClose} title="Edit agent" size="md">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="First name" error={errors.firstName?.message} {...register('firstName')} />
          <Field label="Last name" error={errors.lastName?.message} {...register('lastName')} />
        </div>
        <Field label="Phone" error={errors.phone?.message} {...register('phone')} />
        <Button type="submit" loading={isSubmitting} className="w-full">Save changes</Button>
      </form>
    </Modal>
  );
}

// Agents work for owners: an owner sees and manages their own agents, an
// agent sees the owners they work for, and an organization administrator can
// link any agent to any owner. Deactivating turns off just that owner's link.
export default function AgentsPage() {
  useDocumentTitle('Agents');
  const { user } = useAuth();
  const canManage = canAny(user.roles, CAN_MANAGE_AGENTS);
  const isAdmin = user.roles.includes('administrator');
  const isAgent = user.roles.includes('agent') && !canManage;
  const [links, setLinks] = useState(null);
  const [owners, setOwners] = useState([]);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editLink, setEditLink] = useState(null);
  const [deleteLink, setDeleteLink] = useState(null);

  const load = useCallback(() => {
    setError(null);
    agentsApi.list().then((res) => setLinks(res.data)).catch((err) => setError(err.message));
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isAdmin) ownersApi.options().then((res) => setOwners(res.data)).catch(() => {});
  }, [isAdmin]);

  const toggle = async (link) => {
    setError(null);
    try {
      await agentsApi.setStatus(link.linkId, link.status === 'active' ? 'inactive' : 'active');
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Briefcase}
        eyebrow="Team"
        title={isAgent ? 'My owners' : 'Agents'}
        description={isAgent ? 'The owners you work for.' : 'The agents who manage your properties and tenants.'}
        action={canManage && (
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />
            Add agent
          </Button>
        )}
      />
      {error && <Alert variant="error">{error}</Alert>}
      {!links && !error && <Card><LoadingState label="Loading…" /></Card>}
      {links?.length === 0 && (
        <Card><CardBody className="py-16 text-center text-sm text-slate-500 dark:text-slate-400">{isAgent ? 'You are not linked to any owner yet.' : 'No agents yet.'}</CardBody></Card>
      )}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {links?.map((l) => (
          <Card key={l.linkId ?? l.agent.userId}>
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                    {isAgent ? l.owner?.name : `${l.agent.firstName} ${l.agent.lastName}`}
                  </p>
                  {(isAdmin || isAgent) && !isAgent && l.owner && <p className="truncate text-xs text-slate-500 dark:text-slate-400">Works for {l.owner.name}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {l.status === 'unlinked' ? <Badge tone="neutral">No owner yet</Badge> : <Badge tone={l.status === 'active' ? 'success' : 'danger'}>{l.status === 'active' ? 'Active' : 'Deactivated'}</Badge>}
                  {l.agent.accountStatus === 'pending' && <Badge tone="warning">Invite pending</Badge>}
                </div>
              </div>
              {!isAgent && (
                <div className="flex flex-col gap-1 text-sm text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5 truncate"><Mail size={13} aria-hidden="true" />{l.agent.email}</span>
                  {l.agent.phone && <span className="flex items-center gap-1.5"><Phone size={13} aria-hidden="true" />{l.agent.phone}</span>}
                </div>
              )}
              {l.status === 'unlinked' && <p className="text-xs text-slate-500 dark:text-slate-400">Not working for any owner yet. Use “Add agent” with this email to link them to an owner.</p>}
              {canManage && l.linkId && (
                <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <Button variant="secondary" size="sm" onClick={() => setEditLink(l)}><Pencil size={14} aria-hidden="true" />Edit</Button>
                  <Button variant="secondary" size="sm" onClick={() => toggle(l)}><Power size={14} aria-hidden="true" />{l.status === 'active' ? 'Deactivate' : 'Activate'}</Button>
                  <Button variant="danger" size="sm" onClick={() => setDeleteLink(l)}><Trash2 size={14} aria-hidden="true" />Delete</Button>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <AddAgentModal open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} isAdmin={isAdmin} owners={owners} />
      <EditAgentModal link={editLink} onClose={() => setEditLink(null)} onSaved={load} />
      <ConfirmDialog
        open={Boolean(deleteLink)}
        onClose={() => setDeleteLink(null)}
        onConfirm={async () => { await agentsApi.remove(deleteLink.linkId); load(); }}
        title="Delete this agent?"
        description={deleteLink ? `${deleteLink.agent.firstName} ${deleteLink.agent.lastName} will be removed from ${deleteLink.owner?.name ?? 'your team'}. If they work for no one else, their account is deleted completely.` : ''}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
