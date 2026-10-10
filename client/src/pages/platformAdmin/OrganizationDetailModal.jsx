import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ExternalLink, Mail, Check, ImagePlus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { platformAdminApi } from '../../api/platformAdmin.js';

const hexPattern = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the organization name.').max(150),
  email: z.string().trim().min(1, 'Enter a contact email.').email('Enter a valid email address.'),
  phone: z.string().trim().max(40).optional(),
  primaryColor: z.string().regex(hexPattern, 'Pick a valid color.'),
  secondaryColor: z.string().regex(hexPattern, 'Pick a valid color.'),
});

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-900">
      <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

// Details + editing for one organization: live counts, its administrators
// (each can be sent a password reset link on the company's own branded
// page), and the editable name/contact/colors. The URL name is shown but
// read-only, because every link the company's users hold depends on it.
export function OrganizationDetailModal({ orgId, onClose, onChanged }) {
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [sendingTo, setSendingTo] = useState(null);
  const [sentTo, setSentTo] = useState({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty } } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!orgId) return undefined;
    let cancelled = false;
    setDetail(null);
    setError(null);
    setNotice(null);
    setSentTo({});
    platformAdminApi.getOrganization(orgId)
      .then((res) => {
        if (cancelled) return;
        setDetail(res.data);
        reset({
          name: res.data.name, email: res.data.email, phone: res.data.phone ?? '',
          primaryColor: res.data.primaryColor, secondaryColor: res.data.secondaryColor,
        });
      })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [orgId, reset]);

  const onSubmit = async (body) => {
    setError(null);
    setNotice(null);
    try {
      const res = await platformAdminApi.updateOrganization(orgId, { ...body, phone: body.phone || null });
      setDetail((d) => ({ ...d, ...res.data }));
      reset({ ...body });
      setNotice('Changes saved.');
      onChanged();
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  const onLogoChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingLogo(true);
    setError(null);
    setNotice(null);
    try {
      const res = await platformAdminApi.replaceOrganizationLogo(orgId, file);
      setDetail((d) => ({ ...d, ...res.data }));
      setNotice('Logo updated.');
      onChanged();
    } catch (err) {
      setError(err.details?.map((d) => d.message).join(' ') || err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const sendReset = async (user) => {
    setSendingTo(user.id);
    setError(null);
    try {
      await platformAdminApi.sendOrganizationAdminReset(orgId, user.id);
      setSentTo((s) => ({ ...s, [user.id]: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingTo(null);
    }
  };

  return (
    <Modal open={Boolean(orgId)} onClose={onClose} title={detail?.name ?? 'Organization'} description="Details, administrators and settings." size="lg">
      {!detail && !error && <LoadingState label="Loading…" />}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}
      {notice && <Alert variant="success" className="mb-4">{notice}</Alert>}

      {detail && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Users" value={detail.userCount} />
            <Stat label="Properties" value={detail.propertyCount} />
            <Stat label="Tenants" value={detail.tenantCount} />
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Badge tone={detail.status === 'active' ? 'success' : 'danger'}>{detail.status === 'active' ? 'Active' : 'Deactivated'}</Badge>
            <a href={`${window.location.origin}/${detail.slug}/login`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand-600 hover:underline dark:text-brand-400">
              /{detail.slug}/login <ExternalLink size={12} aria-hidden="true" />
            </a>
            <span className="text-slate-500 dark:text-slate-400">Created {new Date(detail.createdAt).toLocaleDateString()}</span>
          </div>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Logo</h3>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600 dark:text-slate-400">{detail.hasLogo ? 'A logo is set.' : 'No logo yet — the default mark is shown.'}</span>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-within:ring-2 focus-within:ring-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
                <ImagePlus size={14} aria-hidden="true" />
                {uploadingLogo ? 'Uploading…' : detail.hasLogo ? 'Replace logo' : 'Upload logo'}
                <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="sr-only" disabled={uploadingLogo} onChange={onLogoChosen} />
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Administrators</h3>
            {detail.administrators.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">This organization has no administrators.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                {detail.administrators.map((u) => (
                  <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{u.firstName} {u.lastName}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {u.email} · {u.lastLoginAt ? `last sign-in ${new Date(u.lastLoginAt).toLocaleDateString()}` : 'never signed in'}
                      </p>
                    </div>
                    <Button variant="secondary" size="sm" loading={sendingTo === u.id} disabled={sentTo[u.id]} onClick={() => sendReset(u)}>
                      {sentTo[u.id] ? <Check size={14} aria-hidden="true" /> : <Mail size={14} aria-hidden="true" />}
                      {sentTo[u.id] ? 'Link sent' : 'Send reset link'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Settings</h3>
            <Field label="Organization name" error={errors.name?.message} {...register('name')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Contact email" type="email" error={errors.email?.message} {...register('email')} />
              <Field label="Phone (optional)" error={errors.phone?.message} {...register('phone')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Primary color</label>
                <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" {...register('primaryColor')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Secondary color</label>
                <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" {...register('secondaryColor')} />
              </div>
            </div>
            <Button type="submit" loading={isSubmitting} disabled={!isDirty} className="w-full">Save changes</Button>
          </form>
        </div>
      )}
    </Modal>
  );
}
