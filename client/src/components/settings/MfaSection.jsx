import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import QRCode from 'qrcode';
import { ShieldCheck, ShieldOff, Copy, Check } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../ui/Card.jsx';
import { Field } from '../ui/Input.jsx';
import { Button } from '../ui/Button.jsx';
import { Alert } from '../ui/Alert.jsx';
import { authApi } from '../../api/auth.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { mfaConfirmFormSchema, mfaDisableFormSchema } from '../../validations/account.js';

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  );
}

function EnrollWizard({ api, onCancel, onEnabled }) {
  const [step, setStep] = useState('starting'); // starting | scan | done
  const [enrollment, setEnrollment] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(mfaConfirmFormSchema) });
  const started = useRef(false);

  useEffect(() => {
    // Enrollment isn't idempotent — each call mints and stores a new secret
    // server-side, so React 18 StrictMode's double-invoke-in-dev would
    // otherwise fire two enrollments in a race. Guard so exactly one runs.
    if (started.current) return;
    started.current = true;

    api.mfaEnroll()
      .then((res) => {
        setEnrollment(res.data);
        return QRCode.toDataURL(res.data.otpAuthUrl, { margin: 1, width: 220 });
      })
      .then((url) => { setQrDataUrl(url); setStep('scan'); })
      .catch((err) => setServerError(err.message));
  }, []);

  const onConfirm = async (values) => {
    setServerError(null);
    try {
      const res = await api.mfaConfirm(values.code);
      setRecoveryCodes(res.data.recoveryCodes);
      setStep('done');
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (step === 'starting') {
    return serverError ? <Alert variant="error">{serverError}</Alert> : <p className="text-sm text-slate-500 dark:text-slate-400">Starting enrollment…</p>;
  }

  if (step === 'done') {
    return (
      <div className="flex flex-col gap-4">
        <Alert variant="success">Multi-factor authentication is now enabled.</Alert>
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Save these recovery codes somewhere safe — each can be used once if you lose access to your authenticator app. They will not be shown again.
          </p>
          <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono text-sm dark:border-slate-800 dark:bg-slate-950">
            {recoveryCodes.map((c) => <span key={c}>{c}</span>)}
          </div>
          <div className="mt-2">
            <CopyButton value={recoveryCodes.join('\n')} />
          </div>
        </div>
        <div>
          <Button onClick={onEnabled}>Done</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <div className="flex flex-col items-start gap-4 sm:flex-row">
        {qrDataUrl && <img src={qrDataUrl} alt="MFA enrollment QR code" width={180} height={180} className="rounded-lg border border-slate-200 dark:border-slate-800" />}
        <div className="flex-1">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Scan this QR code with your authenticator app (Google Authenticator, 1Password, Authy…). Can't scan? Enter this key manually:
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded-md bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{enrollment?.secret}</code>
            <CopyButton value={enrollment?.secret ?? ''} />
          </div>
        </div>
      </div>
      <form onSubmit={handleSubmit(onConfirm)} noValidate className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
        <Field label="Enter the 6-digit code from your app" autoComplete="one-time-code" error={errors.code?.message} {...register('code')} />
        <div className="flex gap-3">
          <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button type="submit" loading={isSubmitting}>Confirm and enable</Button>
        </div>
      </form>
    </div>
  );
}

function DisableForm({ api, onCancel, onDisabled }) {
  const [serverError, setServerError] = useState(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(mfaDisableFormSchema) });

  const onSubmit = async (values) => {
    setServerError(null);
    try {
      await api.mfaDisable(values);
      onDisabled();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      {serverError && <Alert variant="error">{serverError}</Alert>}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Current password" type="password" autoComplete="current-password" required error={errors.password?.message} {...register('password')} />
        <Field label="Authentication code" autoComplete="one-time-code" required error={errors.code?.message} {...register('code')} />
      </div>
      <div className="flex gap-3">
        <Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="danger" loading={isSubmitting}>Disable MFA</Button>
      </div>
    </form>
  );
}

// An On/Off switch: turning it on starts setup, turning it off asks for the
// password and a code. It only changes after those steps are completed.
function Switch({ on, busy, onClick, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={busy}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-1.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${on ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300' : 'border-slate-300 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}
    >
      <span className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${on ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`}>
        <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
      <span className="pr-1.5">{on ? 'On' : 'Off'}</span>
    </button>
  );
}

// `api` supplies mfaEnroll / mfaConfirm / mfaDisable; `enabled` is the current
// state; `onChanged` refreshes whoever owns that state.
export function MfaCard({ api, enabled, onChanged }) {
  const [mode, setMode] = useState('idle'); // idle | enrolling | disabling

  const finish = async () => {
    await onChanged();
    setMode('idle');
  };

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Two-factor authentication</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Ask for a code from your authenticator app each time you sign in.</p>
        </div>
        <Switch
          on={enabled}
          busy={mode !== 'idle'}
          label="Two-factor authentication"
          onClick={() => setMode(enabled ? 'disabling' : 'enrolling')}
        />
      </CardHeader>
      <CardBody>
        {mode === 'idle' && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            {enabled ? <ShieldCheck size={16} className="text-emerald-600" aria-hidden="true" /> : <ShieldOff size={16} className="text-slate-400" aria-hidden="true" />}
            {enabled ? 'On. A code is required every time you sign in.' : 'Off. Turn it on to protect this account with a second step.'}
          </div>
        )}
        {mode === 'enrolling' && <EnrollWizard api={api} onCancel={() => setMode('idle')} onEnabled={finish} />}
        {mode === 'disabling' && <DisableForm api={api} onCancel={() => setMode('idle')} onDisabled={finish} />}
      </CardBody>
    </Card>
  );
}

export function MfaSection() {
  const { user, refreshUser } = useAuth();
  return <MfaCard api={authApi} enabled={Boolean(user?.mfaEnabled)} onChanged={refreshUser} />;
}
