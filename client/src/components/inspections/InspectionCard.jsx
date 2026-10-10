import { Link } from 'react-router-dom';
import { ClipboardCheck, MapPin, Calendar, Gauge, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';

const STATUS_TONE = { scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export function InspectionCard({ inspection, propertyName, canManage, onComplete, onCancel }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-950 dark:to-accent-950">
        {inspection.coverImageUrl ? (
          <img src={inspection.coverImageUrl} alt={`${inspection.type} inspection`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ClipboardCheck size={28} className="text-brand-300 dark:text-brand-700" aria-hidden="true" />
          </div>
        )}
        <Badge tone={STATUS_TONE[inspection.status] ?? 'neutral'} className="absolute right-2.5 top-2.5 shadow-sm">
          {inspection.status.replace('_', ' ')}
        </Badge>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="truncate font-semibold capitalize text-slate-900 dark:text-slate-100">{inspection.type.replace('_', ' ')} inspection</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-slate-500 dark:text-slate-400">
            <MapPin size={13} className="shrink-0" aria-hidden="true" />
            {propertyName ?? 'Unknown property'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Calendar size={13} className="text-brand-500" aria-hidden="true" />
            {dateFmt.format(new Date(inspection.inspectionDate))}
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <Gauge size={13} className="text-brand-500" aria-hidden="true" />
            {inspection.condition || 'Not assessed'}
          </div>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
          <Link to={`/inspections/${inspection.id}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              <Eye size={14} aria-hidden="true" />
              View inspection
            </Button>
          </Link>
          {canManage && ['scheduled', 'in_progress'].includes(inspection.status) && (
            <>
              <Button size="sm" onClick={onComplete} aria-label="Complete inspection">
                <CheckCircle2 size={14} aria-hidden="true" />
              </Button>
              <Button variant="danger" size="sm" onClick={onCancel} aria-label="Cancel inspection">
                <XCircle size={14} aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
