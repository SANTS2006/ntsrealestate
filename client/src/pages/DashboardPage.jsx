import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Layers, Home, Users, UserSquare2, FileText, Wallet,
  Wrench, TrendingUp, TrendingDown, ArrowUpRight, AlertTriangle,
  ClipboardList, Truck, CalendarClock,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell,
} from 'recharts';
import { Card, CardBody, CardHeader } from '../components/ui/Card.jsx';
import { Badge } from '../components/ui/Badge.jsx';
import { LoadingState } from '../components/ui/Spinner.jsx';
import { Alert } from '../components/ui/Alert.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { dashboardApi } from '../api/dashboard.js';
import { formatCurrency } from '../utils/currency.js';

const dateFmt = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' });

const PAYMENT_TONE = { completed: 'success', pending: 'warning', failed: 'danger', refunded: 'neutral' };
const UNIT_STATUS_LABEL = { available: 'Available', occupied: 'Occupied', reserved: 'Reserved', under_maintenance: 'Maintenance', unavailable: 'Unavailable' };
const UNIT_STATUS_COLOR = { available: '#00D4C0', occupied: '#00529B', reserved: '#0078C8', under_maintenance: '#f59e0b', unavailable: '#94a3b8' };
const MAINTENANCE_STATUS_TONE = { open: 'warning', in_review: 'brand', assigned: 'brand', scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };
const WORK_ORDER_STATUS_TONE = { pending: 'neutral', scheduled: 'brand', in_progress: 'warning', completed: 'success', cancelled: 'neutral' };

function ModuleCard({ to, icon: Icon, label, value }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-semibold leading-tight text-slate-900 dark:text-slate-100">{value}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</p>
      </div>
      <ArrowUpRight size={14} className="shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600" aria-hidden="true" />
    </Link>
  );
}

const HERO_TONE = {
  brand: 'from-brand-600 to-accent-600',
  success: 'from-accent-600 to-accent-500',
  warning: 'from-amber-500 to-amber-400',
  danger: 'from-rose-600 to-rose-500',
};

function HeroStat({ icon: Icon, label, value, tone = 'brand', trend }) {
  return (
    <Card className="overflow-hidden">
      <div className={`h-1 w-full bg-gradient-to-r ${HERO_TONE[tone]}`} />
      <CardBody className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
          {trend != null && (
            <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${trend >= 0 ? 'text-accent-600 dark:text-accent-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {trend >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
              {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${HERO_TONE[tone]} text-white`}>
          <Icon size={20} aria-hidden="true" />
        </span>
      </CardBody>
    </Card>
  );
}

function RevenueTrendChart({ trend }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Revenue vs. expenses</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Last 6 months</p>
      </CardHeader>
      <CardBody>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={trend} margin={{ left: -12 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00529B" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#00529B" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
              <XAxis dataKey="month" stroke="currentColor" className="text-xs text-slate-500" tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" className="text-xs text-slate-500" tickLine={false} axisLine={false} tickFormatter={(v) => formatCurrency(v, { rounded: true })} width={64} />
              <Tooltip formatter={(v) => formatCurrency(v)} contentStyle={{ background: 'var(--tooltip-bg, #fff)', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
              <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#00529B" strokeWidth={2} fill="url(#revGrad)" />
              <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#f43f5e" strokeWidth={2} fill="url(#expGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardBody>
    </Card>
  );
}

function UnitStatusChart({ units }) {
  const pieData = Object.entries(units)
    .filter(([key]) => key !== 'total')
    .map(([key, value]) => ({ name: UNIT_STATUS_LABEL[key] ?? key, key, value }))
    .filter((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Unit status</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">{units.total} total units</p>
      </CardHeader>
      <CardBody>
        {pieData.length === 0 ? (
          <div className="flex h-[260px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">No units yet.</div>
        ) : (
          <>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((entry) => <Cell key={entry.key} fill={UNIT_STATUS_COLOR[entry.key] ?? '#94a3b8'} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--tooltip-bg, #fff)', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
              {pieData.map((d) => (
                <li key={d.key} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: UNIT_STATUS_COLOR[d.key] ?? '#94a3b8' }} />
                  <span className="truncate">{d.name}</span>
                  <span className="ml-auto font-medium text-slate-900 dark:text-slate-100">{d.value}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function RecentPayments({ payments, showTenant }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Recent payments</h2>
        <Link to="/payments" className="text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View all</Link>
      </CardHeader>
      <CardBody className="p-0">
        {payments.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-500 dark:text-slate-400">No payments yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  {showTenant && p.tenant && (
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{p.tenant}</p>
                  )}
                  <p className="text-xs text-slate-500 dark:text-slate-400">{dateFmt.format(new Date(p.paymentDate))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{formatCurrency(p.amount)}</span>
                  <Badge tone={PAYMENT_TONE[p.status] ?? 'neutral'}>{p.status}</Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function StaffDashboard({ data }) {
  return (
    <div className="flex flex-col gap-6">
      {(data.maintenance.emergency > 0 || data.leases.expiringNext30Days > 0) && (
        <div className="flex flex-col gap-2">
          {data.maintenance.emergency > 0 && (
            <Alert variant="warning" title="Emergency maintenance">
              {data.maintenance.emergency} emergency maintenance {data.maintenance.emergency === 1 ? 'request needs' : 'requests need'} attention.
            </Alert>
          )}
          {data.leases.expiringNext30Days > 0 && (
            <Alert variant="info" title="Leases expiring soon">
              {data.leases.expiringNext30Days} {data.leases.expiringNext30Days === 1 ? 'lease is' : 'leases are'} expiring in the next 30 days.
            </Alert>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <ModuleCard to="/properties" icon={Building2} label="Properties" value={data.properties.total} />
        <ModuleCard to="/properties" icon={Layers} label="Buildings" value={data.buildings.total} />
        <ModuleCard to="/properties" icon={Home} label="Units" value={data.units.total} />
        <ModuleCard to="/tenants" icon={Users} label="Tenants" value={data.tenants.total} />
        <ModuleCard to="/owners" icon={UserSquare2} label="Owners" value={data.owners.total} />
        <ModuleCard to="/leases" icon={FileText} label="Active leases" value={data.leases.active} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat icon={Home} label="Occupancy rate" value={`${data.occupancyRate}%`} tone="brand" />
        <HeroStat icon={Wallet} label="Outstanding balance" value={formatCurrency(data.finance.outstandingBalance)} tone={data.finance.outstandingBalance > 0 ? 'warning' : 'success'} />
        <HeroStat icon={TrendingUp} label="Revenue this month" value={formatCurrency(data.finance.monthlyRevenue)} tone="success" />
        <HeroStat
          icon={data.finance.monthlyNetIncome >= 0 ? TrendingUp : AlertTriangle}
          label="Net income this month"
          value={formatCurrency(data.finance.monthlyNetIncome)}
          tone={data.finance.monthlyNetIncome >= 0 ? 'brand' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><RevenueTrendChart trend={data.finance.trend} /></div>
        <UnitStatusChart units={data.units} />
      </div>

      <RecentPayments payments={data.recentPayments} showTenant />
    </div>
  );
}

function StatusBreakdownCard({ title, byStatus, toneMap }) {
  const entries = Object.entries(byStatus).filter(([, count]) => count > 0);
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      </CardHeader>
      <CardBody>
        {entries.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500 dark:text-slate-400">Nothing here yet.</p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {entries.map(([status, count]) => (
              <li key={status} className="flex items-center justify-between gap-3">
                <Badge tone={toneMap[status] ?? 'neutral'}>{status.replace('_', ' ')}</Badge>
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function MaintenanceManagerDashboard({ data }) {
  return (
    <div className="flex flex-col gap-6">
      {(data.maintenance.emergency > 0 || data.inspections.overdue > 0) && (
        <div className="flex flex-col gap-2">
          {data.maintenance.emergency > 0 && (
            <Alert variant="warning" title="Emergency maintenance">
              {data.maintenance.emergency} emergency maintenance {data.maintenance.emergency === 1 ? 'request needs' : 'requests need'} attention.
            </Alert>
          )}
          {data.inspections.overdue > 0 && (
            <Alert variant="warning" title="Overdue inspections">
              {data.inspections.overdue} scheduled {data.inspections.overdue === 1 ? 'inspection is' : 'inspections are'} past due.
            </Alert>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <ModuleCard to="/properties" icon={Building2} label="Properties" value={data.properties.total} />
        <ModuleCard to="/properties" icon={Layers} label="Buildings" value={data.buildings.total} />
        <ModuleCard to="/properties" icon={Home} label="Units" value={data.units.total} />
        <ModuleCard to="/owners" icon={UserSquare2} label="Owners" value={data.owners.total} />
        <ModuleCard to="/tenants" icon={Users} label="Tenants" value={data.tenants.total} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat icon={Wrench} label="Open maintenance requests" value={data.maintenance.open} tone={data.maintenance.emergency > 0 ? 'danger' : 'brand'} />
        <HeroStat icon={ClipboardList} label="Open work orders" value={data.workOrders.open} tone="brand" />
        <HeroStat icon={Truck} label="Vendors" value={data.vendors.total} tone="brand" />
        <HeroStat icon={CalendarClock} label="Inspections due (30 days)" value={data.inspections.upcoming} tone={data.inspections.overdue > 0 ? 'warning' : 'brand'} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StatusBreakdownCard title="Maintenance requests by status" byStatus={data.maintenance.byStatus} toneMap={MAINTENANCE_STATUS_TONE} />
        <StatusBreakdownCard title="Work orders by status" byStatus={data.workOrders.byStatus} toneMap={WORK_ORDER_STATUS_TONE} />
      </div>
    </div>
  );
}

function TenantDashboard({ data }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <HeroStat icon={Wallet} label="Balance due" value={formatCurrency(data.finance.outstandingBalance)} tone={data.finance.outstandingBalance > 0 ? 'warning' : 'success'} />
        <HeroStat icon={Wrench} label="Open maintenance requests" value={data.maintenance.open} tone="brand" />
      </div>
      <RecentPayments payments={data.recentPayments} showTenant={false} />
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    dashboardApi.get()
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch((err) => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-xl bg-gradient-to-r from-brand-800 via-brand-700 to-accent-700 px-6 py-6 text-white">
        <h1 className="text-xl font-semibold">Welcome back, {user?.firstName}</h1>
        <p className="mt-1 text-sm text-brand-100">Here's what's happening across your portfolio today.</p>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {!data && !error && <LoadingState label="Loading dashboard…" />}
      {data && data.view === 'tenant' && <TenantDashboard data={data} />}
      {data && data.view === 'maintenance' && <MaintenanceManagerDashboard data={data} />}
      {data && data.view === 'staff' && <StaffDashboard data={data} />}
    </div>
  );
}
