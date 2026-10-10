import { Link } from 'react-router-dom';
import { hasPermission } from '../../config/capabilities.js';
import { Wrench, MapPin, Calendar, ClipboardCheck, UserCog, XCircle, ArrowUpRight, Trash2 } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

const STATUS_TONE = { open: 'warning', in_review: 'brand', assigned: 'brand', scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const PRIORITY_TONE = { low: 'neutral', medium: 'brand', high: 'warning', emergency: 'danger' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export function MaintenanceRequestCard({ request, propertyName, onReview, onAssign, onCancel, onDelete }) {
  const canUpdate = hasPermission('maintenance:update');
  const canDelete = hasPermission('maintenance:delete');
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Link to={`/maintenance/${request.id}`} className="relative block aspect-[16/9] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {request.coverImageUrl ? (
          <img src={request.coverImageUrl} alt={request.title} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Wrench size={28} className="text-brand-300 dark:text-brand-700" aria-hidden="true" />
          </div>
        )}
        <div className="absolute right-2.5 top-2.5 flex gap-1.5">
          <Badge tone={PRIORITY_TONE[request.priority] ?? 'neutral'} className="shadow-sm">{request.priority}</Badge>
          <Badge tone={STATUS_TONE[request.status] ?? 'neutral'} className="shadow-sm">{request.status.replace('_', ' ')}</Badge>
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{request.title}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500 dark:text-slate-400">
            <MapPin size={13} className="shrink-0" aria-hidden="true" />
            {propertyName ?? 'Unknown property'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
          <Calendar size={13} className="text-brand-500" aria-hidden="true" />
          Reported {dateFmt.format(new Date(request.reportedAt))}
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          {canUpdate && request.status === 'open' && (
            <Button variant="secondary" size="sm" onClick={onReview}>
              <ClipboardCheck size={14} aria-hidden="true" />
              Review
            </Button>
          )}
          {canUpdate && ['open', 'in_review'].includes(request.status) && (
            <Button size="sm" onClick={onAssign}>
              <UserCog size={14} aria-hidden="true" />
              Assign
            </Button>
          )}
          {canUpdate && ['open', 'in_review', 'assigned', 'scheduled'].includes(request.status) && (
            <Button variant="danger" size="sm" onClick={onCancel} aria-label="Cancel request">
              <XCircle size={14} aria-hidden="true" />
            </Button>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Delete request">
              <Trash2 size={14} className="text-rose-500" aria-hidden="true" />
            </Button>
          )}
          <Link to={`/maintenance/${request.id}`} className="ml-auto">
            <Button variant="ghost" size="sm" aria-label="View details">
              <ArrowUpRight size={16} aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
