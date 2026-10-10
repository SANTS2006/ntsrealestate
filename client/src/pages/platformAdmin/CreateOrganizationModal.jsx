import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { platformAdminApi } from '../../api/platformAdmin.js';

const slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const hexPattern = /^#([0-9a-f]{6}|[0-9a-f]{3})$/i;

const schema = z.object({
  name: z.string().trim().min(2, 'Enter the organization name.').max(150),
  slug: z.string().trim().min(2, 'Enter a URL name.').max(50)
    .regex(slugPattern, 'Lowercase letters, numbers, and single hyphens only — e.g. acme-realty.'),
  adminFirstName: z.string().trim().min(1, "Enter the administrator's first name."),
  adminLastName: z.string().trim().min(1, "Enter the administrator's last name."),
  adminEmail: z.string().trim().min(1, 'Enter the administrator email.').email('Enter a valid email address.'),
  primaryColor: z.string().regex(hexPattern, 'Pick a valid color.'),
  secondaryColor: z.string().regex(hexPattern, 'Pick a valid color.'),
});

export function CreateOrganizationModal({ open, onClose, onCreated }) {
  const [serverError, setServerError] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { primaryColor: '#0f172a', secondaryColor: '#0ea5e9' },
  });

  const close = () => {
    reset();
    setLogoFile(null);
    setServerError(null);
    onClose();
  };

  const onSubmit = async (body) => {
    setServerError(null);
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(body)) formData.append(key, value);
      if (logoFile) formData.append('logo', logoFile);

      const res = await platformAdminApi.createOrganization(formData);
      onCreated(res.data);
      close();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Add organization" description="Creates the organization, its administrator account, and emails them their login details." size="lg">
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Organization name" placeholder="e.g. Acme Realty" autoFocus error={errors.name?.message} {...register('name')} />
        <div>
          <Field
            label="URL name"
            placeholder="acme-realty"
            hint="Their whole system lives at this address, e.g. yourapp.com/acme-realty/login"
            error={errors.slug?.message}
            {...register('slug')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Administrator first name" placeholder="Enter first name" error={errors.adminFirstName?.message} {...register('adminFirstName')} />
          <Field label="Administrator last name" placeholder="Enter last name" error={errors.adminLastName?.message} {...register('adminLastName')} />
        </div>
        <Field label="Administrator email" type="email" placeholder="Enter administrator email" hint="Their login and default password are sent here." error={errors.adminEmail?.message} {...register('adminEmail')} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Primary color</label>
            <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" {...register('primaryColor')} />
            {errors.primaryColor && <p className="text-xs text-rose-600 dark:text-rose-400">{errors.primaryColor.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Secondary color</label>
            <input type="color" className="h-10 w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-900" {...register('secondaryColor')} />
            {errors.secondaryColor && <p className="text-xs text-rose-600 dark:text-rose-400">{errors.secondaryColor.message}</p>}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Logo (optional)</label>
          <input
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200 dark:text-slate-400 dark:file:bg-slate-800 dark:file:text-slate-200"
          />
        </div>

        <Button type="submit" loading={isSubmitting} className="mt-2 w-full">
          Create organization
        </Button>
      </form>
    </Modal>
  );
}
