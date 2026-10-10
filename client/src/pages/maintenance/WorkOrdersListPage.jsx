import { useCallback, useEffect, useState } from 'react';
import { ClipboardList, Clock, PlayCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardBody } from '../../components/ui/Card.jsx';
import { SelectField } from '../../components/ui/Input.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { StatCard } from '../../components/ui/StatCard.jsx';
import { WorkOrderCard } from '../../components/maintenance/WorkOrderCard.jsx';
import { CompleteWorkOrderModal } from '../../components/maintenance/CompleteWorkOrderModal.jsx';
import { workOrdersApi } from '../../api/workOrders.js';
import { useStatusCounts } from '../../hooks/useStatusCounts.js';

const STATUS_LIST = ['pending', 'in_progress', 'completed'];

export default function WorkOrdersListPage() {

  const [workOrders, setWorkOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [deleteWO, setDeleteWO] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [completeWO, setCompleteWO] = useState(null);
  const [cancelWO, setCancelWO] = useState(null);
  const statusCounts = useStatusCounts(workOrdersApi.list, STATUS_LIST, [meta.total]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    workOrdersApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setWorkOrders(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const startWorkOrder = async (wo) => { await workOrdersApi.start(wo.id); load(); };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={ClipboardList}
        eyebrow="Maintenance"
        title="Work Orders"
        description="All work orders across maintenance requests."
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ClipboardList} label="Total Work Orders" value={statusCounts?.total ?? '—'} subtext="All work orders" tone="brand" />
        <StatCard icon={Clock} label="Pending" value={statusCounts?.pending ?? '—'} subtext="Not yet started" tone="warning" />
        <StatCard icon={PlayCircle} label="In Progress" value={statusCounts?.in_progress ?? '—'} subtext="Underway" tone="brand" />
        <StatCard icon={CheckCircle2} label="Completed" value={statusCounts?.completed ?? '—'} subtext="Finished" tone="success" />
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </SelectField>
        </CardBody>
      </Card>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <Card><LoadingState label="Loading work orders…" /></Card>
      ) : workOrders.length === 0 ? (
        <Card>
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <ClipboardList size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No work orders found.</p>
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {workOrders.map((wo) => (
              <WorkOrderCard
                key={wo.id}
                workOrder={wo}
                onStart={() => startWorkOrder(wo)}
                onDelete={() => setDeleteWO(wo)}
                onComplete={() => setCompleteWO(wo)}
                onCancel={() => setCancelWO(wo)}
              />
            ))}
          </div>
          <Card>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </Card>
        </>
      )}

      <CompleteWorkOrderModal open={Boolean(completeWO)} onClose={() => setCompleteWO(null)} onSaved={load} workOrder={completeWO} />
      <ConfirmDialog
        open={Boolean(deleteWO)}
        onClose={() => setDeleteWO(null)}
        onConfirm={async () => { await workOrdersApi.remove(deleteWO.id); load(); }}
        title="Delete work order?"
        description="Permanently delete this work order. This cannot be undone."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(cancelWO)}
        onClose={() => setCancelWO(null)}
        onConfirm={async () => { await workOrdersApi.cancel(cancelWO.id); load(); }}
        title="Cancel work order?"
        description="This cannot be undone."
        confirmLabel="Cancel work order"
      />
    </div>
  );
}
