import { useCallback, useEffect, useRef, useState } from 'react';
import { DatabaseBackup, Download, ShieldCheck, RotateCcw, Trash2, Play } from 'lucide-react';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { Card, CardBody, CardHeader } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Modal } from '../../components/ui/Modal.jsx';
import { Field } from '../../components/ui/Input.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Table, Thead, Th, Tbody, Tr, Td } from '../../components/ui/Table.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { platformAdminApi as api } from '../../api/platformAdmin.js';
import { API_URL } from '../../config/env.js';

const fmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' });
const when = (d) => (d ? fmt.format(new Date(d)) : '—');
const size = (n) => (n == null ? '—' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const HEALTH = {
  healthy: { tone: 'success', text: 'Healthy — a verified backup exists from the last day and a half.' },
  stale: { tone: 'warning', text: 'The latest verified backup is more than 36 hours old.' },
  no_valid_backup: { tone: 'danger', text: 'There is no verified backup yet. Create one now.' },
};
const STATUS_TONE = { COMPLETED: 'success', RUNNING: 'brand', FAILED: 'danger', DELETED: 'neutral' };
const RESTORE_STEPS = ['pending', 'preparing', 'backing_up_current_database', 'restoring', 'verifying', 'completed'];
const RESTORE_LABEL = {
  pending: 'Queued', preparing: 'Checking the backup', backing_up_current_database: 'Saving a safety copy of the current database',
  restoring: 'Restoring data', verifying: 'Verifying the restored data', completed: 'Completed', failed: 'Failed',
};

// Platform admin → Backup & Recovery: status, history, manual backup, verify,
// download, and the guarded multi-step restore.
export default function PlatformAdminBackupsPage() {
  useDocumentTitle('Backup & Recovery — Platform Admin');
  const [status, setStatus] = useState(null);
  const [backups, setBackups] = useState(null);
  const [restores, setRestores] = useState([]);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(null);
  const [restoreFor, setRestoreFor] = useState(null);
  const [activeRestoreId, setActiveRestoreId] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      const [s, b, r] = await Promise.all([api.backupStatus(), api.listBackups({ pageSize: 25 }), api.listRestores({ pageSize: 10 })]);
      setStatus(s.data); setBackups(b.data); setRestores(r.data); setError(null);
      if (s.data.activeRestore) setActiveRestoreId(s.data.activeRestore.id);
      return s.data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Poll while a backup or restore is running.
  const working = Boolean(status?.runningBackup || status?.activeRestore);
  useEffect(() => {
    if (!working) return undefined;
    timer.current = setInterval(load, 3000);
    return () => clearInterval(timer.current);
  }, [working, load]);

  const run = async (name, fn, okMessage) => {
    setBusy(name); setError(null); setNotice(null);
    try { await fn(); if (okMessage) setNotice(okMessage); await load(); } catch (err) { setError(err.message); } finally { setBusy(null); }
  };

  const actions = (b) => (
    <>
      <Button size="sm" variant="ghost" title="Verify" aria-label="Verify backup" loading={busy === `v${b.id}`} onClick={() => run(`v${b.id}`, () => api.verifyBackup(b.id), 'Verification finished.')}><ShieldCheck size={14} aria-hidden="true" /></Button>
      <a href={`${API_URL}/platform-admin/backups/${b.id}/download`} title="Download (encrypted)" aria-label="Download encrypted backup" className="inline-flex h-8 items-center rounded-lg px-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><Download size={14} aria-hidden="true" /></a>
      <Button size="sm" variant="ghost" title="Restore…" aria-label="Restore this backup" disabled={!b.valid || working} onClick={() => setRestoreFor(b)}><RotateCcw size={14} aria-hidden="true" /></Button>
      <Button size="sm" variant="ghost" title="Delete" aria-label="Delete backup" loading={busy === `d${b.id}`} onClick={() => { if (window.confirm('Delete this backup?')) run(`d${b.id}`, () => api.deleteBackup(b.id), 'Backup deleted.'); }}><Trash2 size={14} className="text-rose-500" aria-hidden="true" /></Button>
    </>
  );

  if (!status && !error) return <LoadingState label="Loading backups…" />;
  const health = HEALTH[status?.health];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader icon={DatabaseBackup} eyebrow="Platform" title="Backup & Recovery" description="Daily encrypted backups of the whole database, and a guarded way to restore one." action={
        <Button loading={busy === 'create'} disabled={Boolean(status?.runningBackup || status?.activeRestore)} onClick={() => run('create', () => api.createBackup(), 'Backup started. It will appear below when it finishes.')}>
          <Play size={15} aria-hidden="true" /> Back up now
        </Button>
      } />

      {error && <Alert variant="error">{error}</Alert>}
      {notice && <Alert variant="success">{notice}</Alert>}
      {status && !status.durableStorage && <Alert variant="warning" title="Backups are on this server's own disk">That disk is wiped whenever the server is redeployed. Set BACKUP_STORAGE=s3 so backups survive.</Alert>}
      {status && !status.encryptionConfigured && <Alert variant="warning" title="No encryption key">Set BACKUP_ENCRYPTION_KEY. Production refuses to create unencrypted backups.</Alert>}

      {status && (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="min-w-0"><CardBody className="min-w-0 break-words">
            <p className="text-xs uppercase tracking-wide text-slate-400">Status</p>
            <div className="mt-1"><Badge tone={health.tone}>{status.health.replace(/_/g, ' ')}</Badge></div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{health.text}</p>
          </CardBody></Card>
          <Card className="min-w-0"><CardBody className="min-w-0 break-words">
            <p className="text-xs uppercase tracking-wide text-slate-400">Last valid backup</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{when(status.latestValidBackup?.startedAt)}</p>
            <p className="text-xs text-slate-500">{status.latestValidBackup ? `${size(status.latestValidBackup.sizeBytes)} · ${status.latestValidBackup.rowCount} rows` : ''}</p>
          </CardBody></Card>
          <Card className="min-w-0"><CardBody className="min-w-0 break-words">
            <p className="text-xs uppercase tracking-wide text-slate-400">Next automatic backup</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">{status.schedule.enabled ? when(status.schedule.nextRunAt) : 'Scheduler off'}</p>
            <p className="text-xs text-slate-500">Daily at {status.schedule.dailyAtUtc} UTC</p>
          </CardBody></Card>
          <Card className="min-w-0"><CardBody className="min-w-0 break-words">
            <p className="text-xs uppercase tracking-wide text-slate-400">Retention</p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-slate-100">Latest {status.policy.retentionCount} · {status.policy.retentionDays} days</p>
            <p className="text-xs text-slate-500">Storage: {status.storage}{status.encryptionConfigured ? ' · encrypted' : ''}</p>
          </CardBody></Card>
        </div>
      )}

      {(status?.activeRestore || activeRestoreId) && <RestoreProgress id={activeRestoreId} onDone={load} />}

      <Card>
        <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Backup history</h2></CardHeader>
        {backups === null ? <LoadingState label="Loading…" /> : backups.length === 0 ? (
          <CardBody><p className="text-sm text-slate-500">No backups yet.</p></CardBody>
        ) : (
          <>
            {/* Small screens: one card per backup, nothing scrolls sideways. */}
            <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
              {backups.map((b) => (
                <li key={b.id} className="flex min-w-0 flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{when(b.startedAt)}</p>
                    <span className="text-xs capitalize text-slate-500">{b.type.replace('_', ' ').toLowerCase()}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status.toLowerCase()}</Badge>
                    <Badge tone={b.verification === 'VERIFIED' ? 'success' : b.verification === 'FAILED' ? 'danger' : 'neutral'}>{b.verification.toLowerCase()}</Badge>
                    <span className="text-xs text-slate-500">{size(b.sizeBytes)}</span>
                  </div>
                  <p className="text-xs text-slate-500">By {b.createdBy ?? '—'}</p>
                  {b.errorMessage && <p className="break-words text-xs text-rose-600">{b.errorMessage}</p>}
                  {b.status === 'COMPLETED' && <div className="flex gap-1">{actions(b)}</div>}
                </li>
              ))}
            </ul>
            <div className="hidden md:block">
              <Table>
                <Thead><tr><Th>Started</Th><Th>Type</Th><Th>Status</Th><Th>Verified</Th><Th>Size</Th><Th>By</Th><Th><span className="sr-only">Actions</span></Th></tr></Thead>
                <Tbody>
                  {backups.map((b) => (
                    <Tr key={b.id}>
                      <Td>{when(b.startedAt)}</Td>
                      <Td>{b.type.replace('_', ' ').toLowerCase()}</Td>
                      <Td><Badge tone={STATUS_TONE[b.status] ?? 'neutral'}>{b.status.toLowerCase()}</Badge>{b.errorMessage && <p className="mt-1 max-w-xs whitespace-normal text-xs text-rose-600">{b.errorMessage}</p>}</Td>
                      <Td><Badge tone={b.verification === 'VERIFIED' ? 'success' : b.verification === 'FAILED' ? 'danger' : 'neutral'}>{b.verification.toLowerCase()}</Badge></Td>
                      <Td>{size(b.sizeBytes)}</Td>
                      <Td>{b.createdBy ?? '—'}</Td>
                      <Td>{b.status === 'COMPLETED' && <div className="flex justify-end gap-1">{actions(b)}</div>}</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {restores.length > 0 && (
        <Card>
          <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Restore history</h2></CardHeader>
          <ul className="divide-y divide-slate-100 md:hidden dark:divide-slate-800">
            {restores.map((r) => (
              <li key={r.id} className="flex min-w-0 flex-col gap-1.5 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{when(r.startedAt)}</p>
                  <Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'brand'}>{RESTORE_LABEL[r.status] ?? r.status}</Badge>
                </div>
                <p className="text-xs text-slate-500">Backup from {when(r.backupTakenAt)} · by {r.startedBy ?? '—'}</p>
                {r.errorMessage && <p className="break-words text-xs text-rose-600">{r.errorMessage}{r.rolledBack ? ' Nothing was changed.' : ''}</p>}
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <Thead><tr><Th>Started</Th><Th>Backup from</Th><Th>By</Th><Th>Result</Th></tr></Thead>
              <Tbody>
                {restores.map((r) => (
                  <Tr key={r.id}>
                    <Td>{when(r.startedAt)}</Td>
                    <Td>{when(r.backupTakenAt)}</Td>
                    <Td>{r.startedBy ?? '—'}</Td>
                    <Td><Badge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'brand'}>{RESTORE_LABEL[r.status] ?? r.status}</Badge>{r.errorMessage && <p className="mt-1 max-w-sm whitespace-normal text-xs text-rose-600">{r.errorMessage}{r.rolledBack ? ' Nothing was changed.' : ''}</p>}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
        </Card>
      )}

      <RestoreWizard backup={restoreFor} onClose={() => setRestoreFor(null)} onStarted={(r) => { setRestoreFor(null); setActiveRestoreId(r.id); load(); }} />
    </div>
  );
}

function RestoreProgress({ id, onDone }) {
  const [r, setR] = useState(null);
  useEffect(() => {
    if (!id) return undefined;
    let stop = false;
    const tick = async () => {
      try {
        const res = await api.getRestore(id);
        if (stop) return;
        setR(res.data);
        if (!res.data.inProgress) { onDone(); return; }
      } catch { /* the server may be busy; keep trying */ }
      if (!stop) setTimeout(tick, 2500);
    };
    tick();
    return () => { stop = true; };
  }, [id, onDone]);
  if (!r) return null;
  const idx = Math.max(0, RESTORE_STEPS.indexOf(r.status));
  return (
    <Card>
      <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Restore {r.status === 'completed' ? 'finished' : r.status === 'failed' ? 'failed' : 'in progress'}</h2></CardHeader>
      <CardBody className="flex flex-col gap-3">
        <ol className="flex flex-col gap-1.5 text-sm">
          {RESTORE_STEPS.map((s, i) => (
            <li key={s} className={i < idx || r.status === 'completed' ? 'text-emerald-600' : i === idx && r.status !== 'failed' ? 'font-medium text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
              {i < idx || r.status === 'completed' ? '✓' : i === idx && r.status !== 'failed' ? '●' : '○'} {RESTORE_LABEL[s]}
            </li>
          ))}
        </ol>
        {r.status === 'failed' && <Alert variant="error">{r.errorMessage} {r.rolledBack && 'The database was left exactly as it was.'}</Alert>}
        {r.status === 'completed' && <Alert variant="success">Restored. {r.verification?.rows} rows in {r.verification?.tables} tables matched the backup. Sign out and back in if anything looks out of date.</Alert>}
      </CardBody>
    </Card>
  );
}

// Three deliberate steps: pick → read the warning → type the phrase and your password.
function RestoreWizard({ backup, onClose, onStarted }) {
  const [step, setStep] = useState(1);
  const [prep, setPrep] = useState(null);
  const [phrase, setPhrase] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setStep(1); setPrep(null); setPhrase(''); setPassword(''); setError(null); }, [backup?.id]);
  if (!backup) return null;

  const prepare = async () => {
    setBusy(true); setError(null);
    try { const res = await api.prepareRestore(backup.id); setPrep(res.data); setStep(2); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const start = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.startRestore({ backupId: backup.id, token: prep.token, confirmation: phrase, password });
      onStarted(res.data);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={`Restore database — step ${step} of 3`} size="md">
      <div className="flex flex-col gap-4">
        {error && <Alert variant="error">{error}</Alert>}
        {step === 1 && (
          <>
            <p className="text-sm text-slate-600 dark:text-slate-300">Restore the backup taken on <strong>{when(backup.startedAt)}</strong> ({size(backup.sizeBytes)}, {backup.rowCount} rows). First we check the backup is intact.</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={prepare} loading={busy}>Check this backup</Button></div>
          </>
        )}
        {step === 2 && prep && (
          <>
            <Alert variant="warning" title="This replaces live data">{prep.warning}</Alert>
            <p className="text-sm text-slate-600 dark:text-slate-300">Before anything changes, a verified safety backup of the current database is saved. If the restore fails at any point, nothing is changed.</p>
            <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => setStep(3)}>I understand, continue</Button></div>
          </>
        )}
        {step === 3 && prep && (
          <>
            <Field label={`Type ${prep.requiredPhrase} to confirm`} value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
            <Field label="Your password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button variant="danger" onClick={start} loading={busy} disabled={phrase !== prep.requiredPhrase || !password}>Restore now</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
