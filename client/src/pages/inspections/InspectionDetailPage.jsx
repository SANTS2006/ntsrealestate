import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { MapPin, Calendar, UserCog, Mail, Phone, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import { BackLink, DetailHeader, Section, InfoGrid } from '../../components/ui/Detail.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog.jsx';
import { Field, TextareaField } from '../../components/ui/Input.jsx';
import { MediaGallery } from '../../components/media/MediaGallery.jsx';
import { inspectionsApi } from '../../api/inspections.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { CAN_UPDATE_INSPECTIONS, CAN_UPLOAD_DOCUMENTS, CAN_DELETE_DOCUMENTS, canAny } from '../../config/capabilities.js';

const STATUS_TONE = { scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' });

export default function InspectionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  const canManage = canAny(roles, CAN_UPDATE_INSPECTIONS);
  const canUploadMedia = canAny(roles, CAN_UPLOAD_DOCUMENTS);
  const canDeleteMedia = canAny(roles, CAN_DELETE_DOCUMENTS);

  const [inspection, setInspection] = useState(null);
  const [error, setError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm();

  const load = useCallback(() => {
    inspectionsApi.get(id)
      .then((res) => {
        setInspection(res.data);
        reset({ condition: res.data.condition ?? '', notes: res.data.notes ?? '' });
      })
      .catch((err) => setError(err.message));
  }, [id, reset]);

  useEffect(() => { load(); }, [load]);

  const saveRemarks = async (values) => {
    setServerError(null);
    try {
      await inspectionsApi.update(id, values);
      load();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  const completeInspection = async (values) => {
    setServerError(null);
    try {
      await inspectionsApi.complete(id, values);
      load();
    } catch (err) {
      setServerError(err.details?.map((d) => d.message).join(' ') || err.message);
    }
  };

  if (error && !inspection) return <Alert variant="error">{error}</Alert>;
  if (!inspection) return <LoadingState label="Loading inspection…" />;

  const isEditable = ['scheduled', 'in_progress'].includes(inspection.status);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <BackLink to="/inspections">Back to inspections</BackLink>

      {error && <Alert variant="error">{error}</Alert>}
      {serverError && <Alert variant="error">{serverError}</Alert>}

      <DetailHeader
        icon={ClipboardCheck}
        title={<span className="capitalize">{inspection.type.replace('_', ' ')} inspection</span>}
        badges={<Badge tone={STATUS_TONE[inspection.status] ?? 'neutral'}>{inspection.status.replace('_', ' ')}</Badge>}
        subtitle={<><MapPin size={14} className="mt-0.5 shrink-0" aria-hidden="true" /><span className="min-w-0">{inspection.targetLabel ?? inspection.propertyName ?? 'Unknown property'}</span></>}
        actions={canManage && isEditable && (
          <Button variant="danger" onClick={() => setCancelOpen(true)}>
            <XCircle size={15} aria-hidden="true" />
            Cancel inspection
          </Button>
        )}
      />

      <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-2">
          <Section title="Remarks" description="The assigned inspector's condition assessment and notes.">
            <form className="flex flex-col gap-4" onSubmit={handleSubmit(canManage && isEditable ? saveRemarks : () => {})}>
              <Field
                label="Condition"
                placeholder="e.g. Good, Fair, Needs repair"
                disabled={!canManage || !isEditable}
                {...register('condition')}
              />
              <TextareaField
                label="Notes"
                rows={5}
                disabled={!canManage || !isEditable}
                placeholder="Describe what was observed during the inspection…"
                {...register('notes')}
              />
              {canManage && isEditable && (
                <div className="flex flex-wrap justify-end gap-3">
                  <Button type="submit" variant="secondary" loading={isSubmitting}>Save remarks</Button>
                  <Button type="button" loading={isSubmitting} onClick={handleSubmit(completeInspection)}>
                    <CheckCircle2 size={15} aria-hidden="true" />
                    Complete inspection
                  </Button>
                </div>
              )}
            </form>
          </Section>

          <Section title="Photos & videos">
            <MediaGallery entityType="inspection" entityId={id} canUpload={canUploadMedia} canDelete={canDeleteMedia} />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section title="Details">
            <InfoGrid cols={1} items={[
              { icon: Calendar, label: 'Date', value: dateFmt.format(new Date(inspection.inspectionDate)) },
              { icon: UserCog, label: 'Inspector', value: inspection.inspectorName ?? 'Unassigned' },
              { icon: ClipboardCheck, label: 'Type', value: <span className="capitalize">{inspection.type.replace('_', ' ')}</span> },
              { icon: CheckCircle2, label: 'Condition', value: inspection.condition || 'Not assessed' },
            ]} />
          </Section>

          {inspection.tenant && (
            <Section title="Resident">
              <div className="flex min-w-0 flex-col gap-1.5 text-sm">
                <p className="break-words font-medium text-slate-900 dark:text-slate-100">{inspection.tenant.name}</p>
                {inspection.tenant.email && <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Mail size={14} className="shrink-0" aria-hidden="true" /><span className="min-w-0 break-all">{inspection.tenant.email}</span></p>}
                {inspection.tenant.phone && <p className="flex items-center gap-2 text-slate-500 dark:text-slate-400"><Phone size={14} className="shrink-0" aria-hidden="true" />{inspection.tenant.phone}</p>}
              </div>
            </Section>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        onConfirm={async () => { await inspectionsApi.cancel(id); navigate('/inspections', { replace: true }); }}
        title="Cancel inspection?"
        description="This cannot be undone."
        confirmLabel="Cancel inspection"
      />
    </div>
  );
}
