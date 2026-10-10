import { Link } from 'react-router-dom';
import { hasPermission } from '../../config/capabilities.js';
import { ClipboardList, Calendar, Wallet, PlayCircle, CheckCircle2, XCircle, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { pending: 'neutral', scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export function WorkOrderCard({ workOrder, onStart, onComplete, onCancel, onDelete }) {
  const canUpdate = hasPermission('work-orders:update');
  // Only work that never really happened (pending or cancelled) can be deleted.
  const canDelete = hasPermission('work-orders:delete') && ['pending', 'cancelled'].includes(workOrder.status);
  const hasActions = (canUpdate && ['pending', 'scheduled', 'in_progress'].includes(workOrder.status)) || canDelete;
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {workOrder.coverImageUrl ? (
          <img src={workOrder.coverImageUrl} alt="Work order" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ClipboardList size={28} className="text-brand-300 dark:text-brand-700" aria-hidden="true" />
          </div>
        )}
        <Badge tone={STATUS_TONE[workOrder.status] ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">
          {workOrder.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <Link to={`/maintenance/${workOrder.maintenanceRequestId}`} className="text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          View request
        </Link>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Calendar size={13} className="text-brand-500" aria-hidden="true" />
            {workOrder.scheduledDate ? dateFmt.format(new Date(workOrder.scheduledDate)) : 'Not scheduled'}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Wallet size={13} className="text-brand-500" aria-hidden="true" />
            {workOrder.actualCost != null ? formatCurrency(workOrder.actualCost) : workOrder.estimatedCost != null ? `Est. ${formatCurrency(workOrder.estimatedCost)}` : '—'}
          </div>
        </div>

        {hasActions && (
          <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            {canUpdate && ['pending', 'scheduled'].includes(workOrder.status) && (
              <>
                <Button size="sm" className="flex-1" onClick={onStart}>
                  <PlayCircle size={14} aria-hidden="true" />
                  Start
                </Button>
                <Button variant="danger" size="sm" onClick={onCancel} aria-label="Cancel work order">
                  <XCircle size={14} aria-hidden="true" />
                </Button>
              </>
            )}
            {canUpdate && workOrder.status === 'in_progress' && (
              <Button size="sm" className="flex-1" onClick={onComplete}>
                <CheckCircle2 size={14} aria-hidden="true" />
                Complete
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete work order" className="ml-auto">
                <Trash2 size={14} className="text-rose-500" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
