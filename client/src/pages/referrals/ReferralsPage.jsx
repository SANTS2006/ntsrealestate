import { useCallback, useEffect, useState } from 'react';
import { hasPermission } from '../../config/capabilities.js';
import { Gift, Copy, Check, Wallet, CheckCircle2 } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { SelectField } from '../../components/ui/Input.jsx';
import { Badge } from '../../components/ui/Badge.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { Pagination } from '../../components/ui/Pagination.jsx';
import { Table, Thead, Tbody, Tr, Th, Td } from '../../components/ui/Table.jsx';
import { referralsApi } from '../../api/referrals.js';
import { useAuth } from '../../contexts/AuthContext.jsx';
import { useBranding } from '../../contexts/BrandingContext.jsx';
import { CAN_MANAGE_REFERRALS, canAny } from '../../config/capabilities.js';
import { formatCurrency } from '../../utils/currency.js';

const STATUS_TONE = { pending: 'warning', approved: 'brand', paid: 'success' };
const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

function ReferralCodeCard({ code }) {
  const [copied, setCopied] = useState(false);
  const { branding } = useBranding();
  // The link goes to this company's own branded register page.
  const shareLink = `${window.location.origin}/${branding.slug}/register?ref=${code}`;

  const copy = async (value) => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full bg-gradient-to-r from-brand-600 to-accent-600" />
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-accent-600 text-white">
            <Gift size={20} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm text-slate-500 dark:text-slate-400">Your referral code</p>
            <p className="text-xl font-semibold tracking-wide text-slate-900 dark:text-slate-100">{code}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" onClick={() => copy(code)}>
            {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          <Button variant="secondary" onClick={() => copy(shareLink)}>
            <Copy size={15} aria-hidden="true" />
            Copy share link
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function ApproveForm({ referral, onApproved }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!amount) return;
    setBusy(true);
    setError(null);
    try {
      const res = await referralsApi.approve(referral.id, Number(amount));
      onApproved(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-rose-600 dark:text-rose-400">{error}</span>}
      <input
        type="number"
        min="0"
        step="0.01"
        placeholder="Bonus"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="h-8 w-24 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      />
      <Button type="submit" size="sm" loading={busy} disabled={!amount}>Approve</Button>
    </form>
  );
}

export default function ReferralsPage() {
  const { user } = useAuth();
  const canManage = canAny(user?.roles ?? [], CAN_MANAGE_REFERRALS);
  const isTenant = (user?.roles ?? []).includes('tenant');

  const [referrals, setReferrals] = useState(null);
  const [meta, setMeta] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);
  const [payingId, setPayingId] = useState(null);

  const load = useCallback(() => {
    setError(null);
    referralsApi.list({ page, pageSize: 20, status: status || undefined })
      .then((res) => { setReferrals(res.data); setMeta(res.meta); })
      .catch((err) => setError(err.message));
  }, [page, status]);

  useEffect(() => { load(); }, [load]);

  const updateRow = (updated) => {
    setReferrals((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };

  const markPaid = async (id) => {
    setPayingId(id);
    try {
      const res = await referralsApi.markPaid(id);
      updateRow(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setPayingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Referrals</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isTenant ? 'Share your code — earn a bonus when someone you referred signs up.' : 'Every referral in the organization and its bonus status.'}
        </p>
      </div>

      {isTenant && user?.referralCode && <ReferralCodeCard code={user.referralCode} />}

      {canManage && (
        <Card>
          <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <SelectField label="Status" className="sm:w-56" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
            </SelectField>
          </CardBody>
        </Card>
      )}

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        {referrals === null ? (
          <LoadingState label="Loading referrals…" />
        ) : referrals.length === 0 ? (
          <CardBody className="flex flex-col items-center gap-2 py-16 text-center">
            <Gift size={28} className="text-slate-300 dark:text-slate-700" aria-hidden="true" />
            <p className="text-sm text-slate-500 dark:text-slate-400">No referrals yet.</p>
          </CardBody>
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  {!isTenant && <Th>Referred by</Th>}
                  <Th>New tenant</Th>
                  <Th>Code</Th>
                  <Th>Date</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Bonus</Th>
                  {canManage && <Th className="text-right">Actions</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {referrals.map((r) => (
                  <Tr key={r.id}>
                    {!isTenant && <Td>{r.referrer ? `${r.referrer.firstName} ${r.referrer.lastName}` : '—'}</Td>}
                    <Td>{r.referred ? `${r.referred.firstName} ${r.referred.lastName}` : '—'}</Td>
                    <Td className="font-mono text-xs">{r.code}</Td>
                    <Td className="whitespace-nowrap">{dateFmt.format(new Date(r.createdAt))}</Td>
                    <Td><Badge tone={STATUS_TONE[r.status] ?? 'neutral'}>{r.status}</Badge></Td>
                    <Td className="text-right font-medium text-slate-900 dark:text-slate-100">
                      {r.bonusAmount != null ? formatCurrency(r.bonusAmount) : '—'}
                    </Td>
                    {canManage && (
                      <Td>
                        {r.status === 'pending' && hasPermission('referrals:approve') && <ApproveForm referral={r} onApproved={updateRow} />}
                        {r.status === 'approved' && hasPermission('referrals:mark-paid') && (
                          <div className="flex justify-end">
                            <Button size="sm" onClick={() => markPaid(r.id)} loading={payingId === r.id}>
                              <Wallet size={14} aria-hidden="true" />
                              Mark paid
                            </Button>
                          </div>
                        )}
                        {r.status === 'paid' && (
                          <div className="flex items-center justify-end gap-1.5 text-xs text-accent-600 dark:text-accent-400">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            Paid
                          </div>
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} pageSize={meta.pageSize} onPageChange={setPage} />
          </>
        )}
      </Card>
    </div>
  );
}
