import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Plus, ClipboardCheck, CalendarClock, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SelectField } from '../../components/ui/Input.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { InspectionCard } from '../../components/inspections/InspectionCard.jsx';
import { ScheduleInspectionModal } from '../../components/inspections/ScheduleInspectionModal.jsx';
import { CompleteInspectionModal } from '../../components/inspections/CompleteInspectionModal.jsx';
import { inspectionsApi } from '../../api/inspections.js';
import { propertiesApi } from '../../api/properties.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_MANAGE_INSPECTIONS, canAny } from '../../config/capabilities.js';

const STATUS_LIST = ['scheduled', 'in_progress', 'completed'];

export default function InspectionsListPage() {
  const { user } = useAuth();
  const canManage = canAny(user?.roles ?? [], CAN_MANAGE_INSPECTIONS);

  const [inspections, setInspections] = useState([]);
  const [propertyNames, setPropertyNames] = useState({});
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [completeInspection, setCompleteInspection] = useState(null);
  const [cancelInspection, setCancelInspection] = useState(null);
  const statusCounts = useStatusCounts(inspectionsApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    inspectionsApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setInspections(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    propertiesApi.list({ pageSize: 100 }).then((res) => {
      setPropertyNames(Object.fromEntries(res.data.map((p) => [p.id, p.name])));
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardCheck}
        eyebrow="Property Inspections"
        title="Inspections"
        description="Schedule and track property inspections."
        action={canManage && (
          <Button onClick={() => setScheduleOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            Schedule inspection
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ClipboardCheck} label="Total Inspections" value={statusCounts?.total ?? '—'} subtext="All inspections" tone="brand" />
        <StatCard icon={CalendarClock} label="Scheduled" value={statusCounts?.scheduled ?? '—'} subtext="Upcoming" tone="brand" />
        <StatCard icon={Loader2} label="In Progress" value={statusCounts?.in_progress ?? '—'} subtext="Underway" tone="warning" />
        <StatCard icon={CheckCircle2} label="Completed" value={statusCounts?.completed ?? '—'} subtext="Finished" tone="success" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading inspections…" /></Card>
      ) : inspections.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardCheck size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No inspections found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {inspections.map((insp) => (
              <InspectionCard
                key={insp.id}
                inspection={insp}
                propertyName={propertyNames[insp.propertyId]}
                canManage={hasPermission('inspections:update')}
                onComplete={() => setCompleteInspection(insp)}
                onCancel={() => setCancelInspection(insp)}
              />
            ))}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <ScheduleInspectionModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSaved={load} />
      <CompleteInspectionModal open={Boolean(completeInspection)} onClose={() => setCompleteInspection(null)} onSaved={load} inspection={completeInspection} />
      <ConfirmDialog
        open={Boolean(cancelInspection)}
        onClose={() => setCancelInspection(null)}
        onConfirm={async () => { await inspectionsApi.cancel(cancelInspection.id); load(); }}
        title="Cancel inspection?"
        description="This cannot be undone."
        confirmLabel="Cancel inspection"
      />
    </div>
  );
}
