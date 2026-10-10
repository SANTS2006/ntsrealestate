import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, PlayCircle, CheckCircle2, XCircle, ClipboardList, Trash2, Wrench, Building2, DoorOpen, User, UserCog, CalendarDays, CalendarCheck, Flag, Mail, Phone } from 'lucide-react';
import { BackLink, DetailHeader, Section, InfoGrid } from '../../components/ui/Detail.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { MediaGallery } from '../../components/media/MediaGallery.jsx';
import { CreateWorkOrderModal } from '../../components/maintenance/CreateWorkOrderModal.jsx';
import { CompleteWorkOrderModal } from '../../components/maintenance/CompleteWorkOrderModal.jsx';
import { maintenanceApi } from '../../api/maintenance.js';
import { workOrdersApi } from '../../api/workOrders.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { open: 'warning', in_review: 'brand', assigned: 'brand', scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const PRIORITY_TONE = { low: 'neutral', medium: 'brand', high: 'warning', emergency: 'danger' };
const WO_STATUS_TONE = { pending: 'neutral', scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

export default function MaintenanceRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  // Work orders are for staff and vendors — a tenant never sees them.
  const showWorkOrders = !(roles.includes('tenant') && !roles.some((r) => ['administrator', 'agent', 'owner', 'maintenance_manager'].includes(r)));
  const canUploadMedia = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteMedia = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [request, setRequest] = useState(null);
  const [workOrders, setWorkOrders] = useState(null);
  const [error, setError] = useState(null);
  const [createWOOpen, setCreateWOOpen] = useState(false);
  const [completeWO, setCompleteWO] = useState(null);
  const [cancelWO, setCancelWO] = useState(null);
  const [deleteWO, setDeleteWO] = useState(null);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);

  const loadRequest = useCallback(() => {
    maintenanceApi.get(id).then((res) => setRequest(res.data)).catch((err) => setError(err.message));
  }, [id]);

  const loadWorkOrders = useCallback(() => {
    if (!showWorkOrders) return;
    maintenanceApi.listWorkOrders(id).then((res) => setWorkOrders(res.data)).catch((err) => setError(err.message));
  }, [id, showWorkOrders]);

  useEffect(() => { loadRequest(); loadWorkOrders(); }, [loadRequest, loadWorkOrders]);

  const startWorkOrder = async (wo) => {
    await workOrdersApi.start(wo.id);
    loadWorkOrders();
    loadRequest();
  };

  if (error && !request) return <Alert variant="error">{error}</Alert>;
  if (!request) return <LoadingState label="Loading maintenance request…" />;

  const canCreateWorkOrder = hasPermission('work-orders:create') && ['assigned', 'scheduled'].includes(request.status);
  const canUpdateWorkOrders = hasPermission('work-orders:update');
  const canDeleteWorkOrders = hasPermission('work-orders:delete');
  const canDeleteRequest = hasPermission('maintenance:delete');

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink to="/maintenance">Back to maintenance requests</BackLink>

      {error && <Alert variant="error">{error}</Alert>}

      <DetailHeader
        icon={Wrench}
        title={request.title}
        badges={(
          <>
            <Badge tone={PRIORITY_TONE[request.priority] ?? 'neutral'}>{request.priority}</Badge>
            <Badge tone={STATUS_TONE[request.status] ?? 'neutral'}>{request.status.replace('_', ' ')}</Badge>
          </>
        )}
        subtitle={<>Reported {dateFmt.format(new Date(request.reportedAt))}{request.propertyName ? ` · ${request.propertyName}` : ''}</>}
        actions={canDeleteRequest && (
          <Button variant="danger" size="sm" onClick={() => setDeleteRequestOpen(true)}>
            <Trash2 size={14} aria-hidden="true" />
            Delete request
          </Button>
        )}
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          {request.description && (
            <Section title="What happened">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 dark:text-slate-300">{request.description}</p>
            </Section>
          )}

          <Section title="Photos & videos">
            <MediaGallery entityType="maintenance_request" entityId={id} canUpload={canUploadMedia} canDelete={canDeleteMedia} />
          </Section>

          {showWorkOrders && (
          <Section
            title="Work orders"
            bodyClassName="p-0"
            action={canCreateWorkOrder && (
              <Button variant="secondary" size="sm" onClick={() => setCreateWOOpen(true)}>
                <Plus size={14} aria-hidden="true" />
                Add work order
              </Button>
            )}
          >
            {workOrders === null ? (
              <div className="p-6"><LoadingState label="Loading work orders…" /></div>
            ) : workOrders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <ClipboardList size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
                <p className="px-4 text-sm text-slate-500 dark:text-slate-400">
                  {request.status === 'assigned' || request.status === 'scheduled' ? 'No work orders yet.' : 'A work order can be added once this request is assigned.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {workOrders.map((wo) => (
                  <li key={wo.id} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-900 dark:text-slate-100">Work order</p>
                        <Badge tone={WO_STATUS_TONE[wo.status] ?? 'neutral'}>{wo.status.replace('_', ' ')}</Badge>
                      </div>
                      <p className="mt-0.5 break-words text-sm text-slate-500 dark:text-slate-400">
                        {wo.scheduledDate ? `Scheduled ${dateFmt.format(new Date(wo.scheduledDate))}` : 'Not yet scheduled'}
                        {wo.estimatedCost != null && <> · Est. {formatCurrency(wo.estimatedCost)}</>}
                        {wo.actualCost != null && <> · Actual {formatCurrency(wo.actualCost)}</>}
                      </p>
                    </div>
                    {(canUpdateWorkOrders || (canDeleteWorkOrders && ['pending', 'cancelled'].includes(wo.status))) && (
                      <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                        {canUpdateWorkOrders && ['pending', 'scheduled'].includes(wo.status) && (
                          <>
                            <Button size="sm" onClick={() => startWorkOrder(wo)}>
                              <PlayCircle size={14} aria-hidden="true" />
                              Start
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => setCancelWO(wo)}>
                              <XCircle size={14} aria-hidden="true" />
                              Cancel
                            </Button>
                          </>
                        )}
                        {canUpdateWorkOrders && wo.status === 'in_progress' && (
                          <Button size="sm" onClick={() => setCompleteWO(wo)}>
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Complete
                          </Button>
                        )}
                        {canDeleteWorkOrders && ['pending', 'cancelled'].includes(wo.status) && (
                          <Button variant="danger" size="sm" onClick={() => setDeleteWO(wo)} aria-label="Delete work order">
                            <Trash2 size={14} aria-hidden="true" />
                            Delete
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Details">
            <InfoGrid cols={1} items={[
              { icon: Building2, label: 'Property', value: request.propertyName },
              request.unitNumber ? { icon: DoorOpen, label: 'Unit', value: request.unitNumber } : null,
              { icon: Flag, label: 'Priority', value: <span className="capitalize">{request.priority}</span> },
              { icon: UserCog, label: 'Assigned to', value: request.assignedToName ?? 'Not assigned yet' },
              { icon: CalendarDays, label: 'Reported', value: dateFmt.format(new Date(request.reportedAt)) },
              { icon: CalendarCheck, label: 'Resolved', value: request.resolvedAt ? dateFmt.format(new Date(request.resolvedAt)) : null },
            ]} />
          </Section>

          {request.tenant && (
            <Section title="Reported by">
              <div className="flex min-w-0 flex-col gap-1.5 text-sm">
                <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100"><User size={14} className="shrink-0 text-slate-400" aria-hidden="true" /><span className="min-w-0 break-words">{request.tenant.name}</span></p>
                {request.tenant.email && <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Mail size={14} className="shrink-0" aria-hidden="true" /><span className="min-w-0 break-all">{request.tenant.email}</span></p>}
                {request.tenant.phone && <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Phone size={14} className="shrink-0" aria-hidden="true" />{request.tenant.phone}</p>}
              </div>
            </Section>
          )}
        </div>
      </div>

      <CreateWorkOrderModal open={createWOOpen} onClose={() => setCreateWOOpen(false)} onSaved={() => { loadWorkOrders(); loadRequest(); }} request={request} />
      <CompleteWorkOrderModal open={Boolean(completeWO)} onClose={() => setCompleteWO(null)} onSaved={() => { loadWorkOrders(); loadRequest(); }} workOrder={completeWO} />
      <ConfirmDialog
        open={Boolean(deleteWO)}
        onClose={() => setDeleteWO(null)}
        onConfirm={async () => { await workOrdersApi.remove(deleteWO.id); loadWorkOrders(); }}
        title="Delete work order?"
        description="Permanently delete this work order. This cannot be undone."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={deleteRequestOpen}
        onClose={() => setDeleteRequestOpen(false)}
        onConfirm={async () => { await maintenanceApi.remove(id); navigate('/maintenance', { replace: true }); }}
        title="Delete request?"
        description="Permanently delete this request, including its work orders and photos. This cannot be undone."
        confirmLabel="Delete"
      />
      <ConfirmDialog
        open={Boolean(cancelWO)}
        onClose={() => setCancelWO(null)}
        onConfirm={async () => { await workOrdersApi.cancel(cancelWO.id); loadWorkOrders(); }}
        title="Cancel work order?"
        description="This cannot be undone."
        confirmLabel="Cancel work order"
      />
    </div>
  );
}
