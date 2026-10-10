import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';

const VARIANTS = {
  error: {
    icon: XCircle,
    classes: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  },
  success: {
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    classes: 'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400',
  },
  info: {
    icon: Info,
    classes: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  },
};

export function Alert({ variant = 'info', title, children, className }) {
  const { icon: Icon, classes } = VARIANTS[variant];
  return (
    <div role={variant === 'error' ? 'alert' : 'status'} className={clsx('flex gap-3 rounded-lg px-4 py-3 text-sm', classes, className)}>
      <Icon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
      <div>
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
    </div>
  );
}
