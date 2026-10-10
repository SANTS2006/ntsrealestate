import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { BarChart3, Building2, Wallet, Wrench } from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardHeader, CardBody } from '../../components/ui/Card.jsx';
import { Field, SelectField } from '../../components/ui/Input.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { LoadingState } from '../../components/ui/Spinner.jsx';
import { PageHeader } from '../../components/ui/PageHeader.jsx';
import { reportsApi } from '../../api/reports.js';
import { propertiesApi } from '../../api/properties.js';
import { formatCurrency } from '../../utils/currency.js';

const PIE_COLORS = ['#10b981', '#2563eb', '#f59e0b', '#f43f5e', '#94a3b8'];
const STATUS_LABEL = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved', under_maintenance: 'Under maintenance', unavailable: 'Unavailable' };

function KpiCard({ icon: Icon, label, value, tone = 'brand' }) {
  const toneClass = { brand: 'bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400', success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400', danger: 'bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400' }[tone];
  return (
    <Card>
      <CardBody className="flex items-center gap-4">
        <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', toneClass)}>
          <Icon size={20} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
        </div>
      </CardBody>
    </Card>
  );
}

function ChartCard({ title, children }) {
  return (
    <Card>
      <CardHeader><h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2></CardHeader>
      <CardBody>
        <div style={{ width: '100%', height: 280 }}>{children}</div>
      </CardBody>
    </Card>
  );
}

function FinancialTab({ propertyId, from, to }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    reportsApi.financialSummary({ propertyId: propertyId || undefined, from: from || undefined, to: to || undefined })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, [propertyId, from, to]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <LoadingState label="Loading financial summary…" />;

  const chartData = [{ name: 'This period', Revenue: data.revenue, Expenses: data.expenses }];

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Wallet} label="Revenue" value={formatCurrency(data.revenue)} tone="success" />
        <KpiCard icon={Wallet} label="Expenses" value={formatCurrency(data.expenses)} tone="danger" />
        <KpiCard icon={BarChart3} label="Net income" value={formatCurrency(data.netIncome)} tone={data.netIncome >= 0 ? 'brand' : 'danger'} />
      </div>
      <ChartCard title="Revenue vs. expenses">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis dataKey="name" stroke="currentColor" className="text-xs text-slate-500" />
            <YAxis stroke="currentColor" className="text-xs text-slate-500" tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: 'var(--tooltip-bg, #fff)', border: '1px solid #e2e8f0', borderRadius: 8 }} />
            <Legend />
            <Bar dataKey="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function OccupancyTab({ propertyId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    reportsApi.occupancy({ propertyId: propertyId || undefined })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, [propertyId]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <LoadingState label="Loading occupancy report…" />;

  const pieData = Object.entries(data.units)
    .filter(([key]) => key !== 'total')
    .map(([key, value]) => ({ name: STATUS_LABEL[key] ?? key, value }))
    .filter((d) => d.value > 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Building2} label="Properties" value={data.properties} />
        <KpiCard icon={Building2} label="Total units" value={data.units.total} />
        <KpiCard icon={BarChart3} label="Occupancy rate" value={`${data.occupancyRate}%`} tone="success" />
      </div>
      <ChartCard title="Unit status breakdown">
        {pieData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">No units yet.</div>
        ) : (
          <ResponsiveContainer>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {pieData.map((entry, i) => <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}

function RentCollectionTab({ propertyId, from, to }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    reportsApi.rentCollection({ propertyId: propertyId || undefined, from: from || undefined, to: to || undefined })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, [propertyId, from, to]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <LoadingState label="Loading rent collection report…" />;

  const chartData = Object.entries(data.byStatus).map(([status, count]) => ({ status: status.replace('_', ' '), count }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard icon={Wallet} label="Total billed" value={formatCurrency(data.totalBilled)} />
        <KpiCard icon={Wallet} label="Collected" value={formatCurrency(data.totalCollected)} tone="success" />
        <KpiCard icon={Wallet} label="Outstanding" value={formatCurrency(data.totalOutstanding)} tone={data.totalOutstanding > 0 ? 'danger' : 'brand'} />
      </div>
      <ChartCard title="Invoices by status">
        <ResponsiveContainer>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
            <XAxis dataKey="status" stroke="currentColor" className="text-xs text-slate-500" />
            <YAxis allowDecimals={false} stroke="currentColor" className="text-xs text-slate-500" />
            <Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function MaintenanceTab({ propertyId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setData(null);
    setError(null);
    reportsApi.maintenanceSummary({ propertyId: propertyId || undefined })
      .then((res) => setData(res.data))
      .catch((err) => setError(err.message));
  }, [propertyId]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <LoadingState label="Loading maintenance summary…" />;

  const statusData = Object.entries(data.byStatus).map(([status, count]) => ({ status: status.replace('_', ' '), count }));
  const priorityData = Object.entries(data.byPriority).map(([priority, count]) => ({ priority, count }));
  const totalOpen = data.byStatus.open + data.byStatus.in_review + data.byStatus.assigned + data.byStatus.scheduled + data.byStatus.in_progress;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiCard icon={Wrench} label="Open requests" value={totalOpen} tone={totalOpen > 0 ? 'danger' : 'success'} />
        <KpiCard icon={Wrench} label="Completed" value={data.byStatus.completed} tone="success" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="By status">
          <ResponsiveContainer>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis type="number" allowDecimals={false} stroke="currentColor" className="text-xs text-slate-500" />
              <YAxis type="category" dataKey="status" width={90} stroke="currentColor" className="text-xs text-slate-500" />
              <Tooltip />
              <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="By priority">
          <ResponsiveContainer>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" />
              <XAxis dataKey="priority" stroke="currentColor" className="text-xs text-slate-500" />
              <YAxis allowDecimals={false} stroke="currentColor" className="text-xs text-slate-500" />
              <Tooltip />
              <Bar dataKey="count" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

const TABS = [
  { id: 'financial', label: 'Financial Summary', dateRange: true },
  { id: 'occupancy', label: 'Occupancy', dateRange: false },
  { id: 'rent-collection', label: 'Rent Collection', dateRange: true },
  { id: 'maintenance', label: 'Maintenance', dateRange: false },
];

export default function ReportsPage() {
  const [tab, setTab] = useState('financial');
  const [properties, setProperties] = useState([]);
  const [propertyId, setPropertyId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    propertiesApi.list({ pageSize: 100 }).then((res) => setProperties(res.data)).catch(() => {});
  }, []);

  const activeTab = TABS.find((t) => t.id === tab);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={BarChart3}
        eyebrow="Financial Summaries"
        title="Reports"
        description="Financial and operational insights across your portfolio."
      />

      <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={clsx(
              'border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.id
                ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <SelectField label="Property" className="sm:w-64" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">All properties</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </SelectField>
          {activeTab.dateRange && (
            <>
              <Field label="From" type="date" className="sm:w-48" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Field label="To" type="date" className="sm:w-48" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
        </CardBody>
      </Card>

      {tab === 'financial' && <FinancialTab propertyId={propertyId} from={from} to={to} />}
      {tab === 'occupancy' && <OccupancyTab propertyId={propertyId} />}
      {tab === 'rent-collection' && <RentCollectionTab propertyId={propertyId} from={from} to={to} />}
      {tab === 'maintenance' && <MaintenanceTab propertyId={propertyId} />}
    </div>
  );
}
