import { useCallback, useEffect, useState } from 'react';
import { Plus, Wrench, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SelectField } from '../../components/ui/Input.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { MaintenanceRequestCard } from '../../components/maintenance/MaintenanceRequestCard.jsx';
import { CreateMaintenanceRequestModal } from '../../components/maintenance/CreateMaintenanceRequestModal.jsx';
import { AssignMaintenanceModal } from '../../components/maintenance/AssignMaintenanceModal.jsx';
import { maintenanceApi } from '../../api/maintenance.js';
import { propertiesApi } from '../../api/properties.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';
import { CAN_CREATE_MAINTENANCE, canAny } from '../../config/capabilities.js';

const OPEN_STATUS_LIST = ['open', 'in_progress', 'completed'];

export default function MaintenanceRequestsListPage() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canCreate = canAny(roles, CAN_CREATE_MAINTENANCE);

  const [requests, setRequests] = useState([]);
  const [propertyNames, setPropertyNames] = useState({});
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [priority, setPriority] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [assignRequest, setAssignRequest] = useState(null);
  const [reviewRequest, setReviewRequest] = useState(null);
  const [cancelRequest, setCancelRequest] = useState(null);
  const [deleteRequest, setDeleteRequest] = useState(null);
  const statusCounts = useStatusCounts(maintenanceApi.list, OPEN_STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    maintenanceApi.list({ page, pageSize: 20, status: status || undefined, priority: priority || undefined })
      .then((res) => { setRequests(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status, priority]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    propertiesApi.list({ pageSize: 100 }).then((res) => {
      setPropertyNames(Object.fromEntries(res.data.map((p) => [p.id, p.name])));
    }).catch(() => {});
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Wrench}
        eyebrow="Maintenance"
        title="Maintenance Requests"
        description="Track and resolve maintenance issues."
        action={canCreate && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus size={16} aria-hidden="true" />
            New request
          </Button>
        )}
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Wrench} label="Total Requests" value={statusCounts?.total ?? '—'} subtext="All requests" tone="brand" />
        <StatCard icon={AlertTriangle} label="Open" value={statusCounts?.open ?? '—'} subtext="Needs attention" tone="warning" />
        <StatCard icon={Loader2} label="In Progress" value={statusCounts?.in_progress ?? '—'} subtext="Being worked on" tone="brand" />
        <StatCard icon={CheckCircle2} label="Completed" value={statusCounts?.completed ?? '—'} subtext="Resolved" tone="success" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="in_review">In review</option>
            <option value="assigned">Assigned</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
          <SelectField label="Priority" className="sm:w-48" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }}>
            <option value="">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="emergency">Emergency</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading maintenance requests…" /></Card>
      ) : requests.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Wrench size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No maintenance requests found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {requests.map((r) => (
              <MaintenanceRequestCard
                key={r.id}
                request={r}
                propertyName={propertyNames[r.propertyId]}
                onReview={() => setReviewRequest(r)}
                onDelete={() => setDeleteRequest(r)}
                onAssign={() => setAssignRequest(r)}
                onCancel={() => setCancelRequest(r)}
              />
            ))}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <CreateMaintenanceRequestModal open={createOpen} onClose={() => setCreateOpen(false)} onSaved={load} />
      <AssignMaintenanceModal open={Boolean(assignRequest)} onClose={() => setAssignRequest(null)} onSaved={load} request={assignRequest} />
      <ConfirmDialog
        open={Boolean(reviewRequest)}
        onClose={() => setReviewRequest(null)}
        onConfirm={async () => { await maintenanceApi.review(reviewRequest.id); load(); }}
        title="Move to review?"
        description={reviewRequest ? `Move "${reviewRequest.title}" into review.` : ''}
        confirmLabel="Move to review"
        variant="primary"
      />
      <ConfirmDialog
        open={Boolean(deleteRequest)}
        onClose={() => setDeleteRequest(null)}
        onConfirm={async () => { await maintenanceApi.remove(deleteRequest.id); load(); }}
        title="Delete request?"
        description={deleteRequest ? `Permanently delete "${deleteRequest.title}", including its work orders and photos. This cannot be undone.` : ''}
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(cancelRequest)}
        onClose={() => setCancelRequest(null)}
        onConfirm={async () => { await maintenanceApi.cancel(cancelRequest.id); load(); }}
        title="Cancel request?"
        description={cancelRequest ? `Cancel "${cancelRequest.title}". This cannot be undone.` : ''}
        confirmLabel="Cancel request"
      />
    </div>
  );
}
