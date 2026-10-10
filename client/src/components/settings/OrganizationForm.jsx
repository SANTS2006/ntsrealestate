import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardHeader, CardBody } from '../ui/Card.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { LoadingState } from '../ui/Spinner.jsx';
import { organizationsApi } from '../../api/organizations.js';
import { organizationFormSchema } from '../../validations/organization.js';

export function OrganizationForm({ canManage }) {
  const [organization, setOrganization] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(organizationFormSchema) });

  useEffect(() => {
    organizationsApi.getMe()
      .then((res) => {
        setOrganization(res.data);
        reset({
          name: res.data.name,
          legalName: res.data.legalName ?? '',
          registrationNumber: res.data.registrationNumber ?? '',
          phone: res.data.phone ?? '',
          address: res.data.address ?? '',
          city: res.data.city ?? '',
          region: res.data.region ?? '',
          country: res.data.country ?? '',
        });
      })
      .catch((err) => setLoadError(err.message));
  }, [reset]);

  const onSubmit = async (values) => {
    setServerError(null);
    setSuccess(false);
    try {
      const res = await organizationsApi.updateMe(values);
      setOrganization(res.data);
      setSuccess(true);
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (loadError) return <Alert variant="error">{loadError}</Alert>;
  if (!organization) return <LoadingState label="Loading organization…" />;

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Organization details</h2>
        {!canManage && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Read-only — only an administrator can make changes.</p>}
      </CardHeader>
      <CardBody>
        {success && <Alert variant="success" className="mb-4">Organization updated.</Alert>}
        {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
          <fieldset disabled={!canManage} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Organization name" required error={errors.name?.message} {...register('name')} />
              <Field label="Legal name" error={errors.legalName?.message} {...register('legalName')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Registration number" error={errors.registrationNumber?.message} {...register('registrationNumber')} />
              <Field label="Phone" error={errors.phone?.message} {...register('phone')} />
            </div>
            <Field label="Address" error={errors.address?.message} {...register('address')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field label="City" error={errors.city?.message} {...register('city')} />
              <Field label="Region / State" error={errors.region?.message} {...register('region')} />
              <Field label="Country" error={errors.country?.message} {...register('country')} />
            </div>
          </fieldset>
          {canManage && (
            <div>
              <Button type="submit" loading={isSubmitting}>Save changes</Button>
            </div>
          )}
        </form>
      </CardBody>
    </Card>
  );
}
