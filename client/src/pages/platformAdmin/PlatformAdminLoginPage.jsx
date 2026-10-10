import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Field } from '../../components/ui/Input.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { PlatformAuthShell } from '../../components/platformAdmin/PlatformAuthShell.jsx';
import { usePlatformAdmin } from '../../contexts/PlatformAdminContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

export default function PlatformAdminLoginPage() {
  useDocumentTitle('Platform Admin');
  const { login } = usePlatformAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const redirectTo = location.state?.from ?? '/platform-admin';

  const onSubmit = async (body) => {
    setServerError(null);
    try {
      await login(body.email, body.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setServerError(err.message);
    }
  };

  return (
    <PlatformAuthShell title="Platform Admin">
      {location.state?.justReset && <Alert variant="success" className="mb-4">Password updated. Sign in with your new password.</Alert>}
      {serverError && <Alert variant="error" className="mb-4">{serverError}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
        <Field label="Email address" type="email" placeholder="Enter your email" autoComplete="email" autoFocus glass error={errors.email?.message} {...register('email')} />
        <div>
          <Field label="Password" type="password" placeholder="Enter your password" autoComplete="current-password" glass error={errors.password?.message} {...register('password')} />
          <div className="mt-2 text-right">
            <Link to="/platform-admin/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400">
              Forgot password?
            </Link>
          </div>
        </div>
        <Button type="submit" loading={isSubmitting} className="w-full mt-2">Sign in</Button>
      </form>
    </PlatformAuthShell>
  );
}
