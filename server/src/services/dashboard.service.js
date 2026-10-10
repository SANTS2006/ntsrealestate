import { countPropertiesByOrganization } from '../repositories/property.repository.js';
import { countBuildingsByOrganization } from '../repositories/building.repository.js';
import { getUnitSummaryForScope } from '../repositories/unit.repository.js';
import { countLeasesByOrganization, countExpiringLeases } from '../repositories/lease.repository.js';
import { sumOutstandingBalance } from '../repositories/invoice.repository.js';
import { sumCompletedPayments, findPaymentsByOrganization, findCompletedPaymentsSince } from '../repositories/payment.repository.js';
import { sumApprovedExpenses, findApprovedExpensesSince } from '../repositories/expense.repository.js';
import { countMaintenanceRequestsByOrganization, getMaintenanceRequestStatusSummary } from '../repositories/maintenanceRequest.repository.js';
import { getWorkOrderStatusSummary } from '../repositories/workOrder.repository.js';
import { countVendorsByOrganization } from '../repositories/vendor.repository.js';
import { countUpcomingInspections, countOverdueInspections } from '../repositories/inspection.repository.js';
import { countTenantsByOrganization, findTenantByUserId } from '../repositories/tenant.repository.js';
import { countOwnersByOrganization } from '../repositories/owner.repository.js';
import { getRestrictedScope, NO_MATCH_ID } from './resourceAccess.service.js';

const OPEN_MAINTENANCE_STATUSES = ['open', 'in_review', 'assigned', 'scheduled', 'in_progress'];
const OPEN_WORK_ORDER_STATUSES = ['pending', 'scheduled', 'in_progress'];
const TREND_MONTHS = 6;
const UPCOMING_INSPECTION_WINDOW_DAYS = 30;
// Roles that get the full org-/scope-wide financial staff dashboard even if
// they also happen to hold maintenance_manager — maintenance_manager only
// gets its own ops-focused view when it's the caller's sole elevated role.
const RICHER_DASHBOARD_ROLES = ['administrator', 'accountant', 'agent', 'owner', 'auditor'];

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function round2(n) {
  return Math.round(Number(n ?? 0) * 100) / 100;
}

// Builds the last TREND_MONTHS calendar months (oldest first) as empty
// revenue/expense buckets, then fills them from raw payment/expense rows —
// avoids a non-portable SQL date-trunc groupBy for what is a small, bounded
// window of rows.
function buildMonthlyTrend(payments, expenses) {
  const now = new Date();
  const buckets = [];
  const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}`;
  const indexByKey = new Map();

  for (let i = TREND_MONTHS - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    indexByKey.set(keyOf(d), buckets.length);
    buckets.push({ month: d.toLocaleString('en-US', { month: 'short' }), revenue: 0, expenses: 0 });
  }

  for (const p of payments) {
    const idx = indexByKey.get(keyOf(new Date(p.paymentDate)));
    if (idx !== undefined) buckets[idx].revenue += Number(p.amount);
  }
  for (const e of expenses) {
    const idx = indexByKey.get(keyOf(new Date(e.expenseDate)));
    if (idx !== undefined) buckets[idx].expenses += Number(e.amount);
  }

  return buckets.map((b) => ({ ...b, revenue: round2(b.revenue), expenses: round2(b.expenses) }));
}

// Staff/owner view: organization- or scope-wide KPIs. See
// docs/api/api-guide.md for the full field list and role-scoping notes.
async function getStaffDashboard(organizationId, propertyIds) {
  const monthStart = startOfMonth();
  const trendStart = new Date(monthStart.getFullYear(), monthStart.getMonth() - (TREND_MONTHS - 1), 1);

  const [
    totalProperties, totalBuildings, unitSummary, activeLeases, expiringLeases,
    outstandingBalance, monthlyRevenue, monthlyExpenses,
    openMaintenance, emergencyMaintenance, recentPayments,
    totalTenants, totalOwners, trendPayments, trendExpenses,
  ] = await Promise.all([
    countPropertiesByOrganization(organizationId, { propertyIds }),
    countBuildingsByOrganization(organizationId, { propertyIds }),
    getUnitSummaryForScope(organizationId, propertyIds),
    countLeasesByOrganization(organizationId, { status: 'active', propertyIds }),
    countExpiringLeases(organizationId, { propertyIds, withinDays: 30 }),
    sumOutstandingBalance(organizationId, { propertyIds }),
    sumCompletedPayments(organizationId, { propertyIds, from: monthStart }),
    sumApprovedExpenses(organizationId, { propertyIds, from: monthStart }),
    countMaintenanceRequestsByOrganization(organizationId, { status: OPEN_MAINTENANCE_STATUSES, propertyIds }),
    countMaintenanceRequestsByOrganization(organizationId, { status: OPEN_MAINTENANCE_STATUSES, priority: 'emergency', propertyIds }),
    findPaymentsByOrganization(organizationId, { skip: 0, take: 5, propertyIds }),
    countTenantsByOrganization(organizationId, { propertyIds }),
    countOwnersByOrganization(organizationId, { propertyIds }),
    findCompletedPaymentsSince(organizationId, { propertyIds, from: trendStart }),
    findApprovedExpensesSince(organizationId, { propertyIds, from: trendStart }),
  ]);

  const revenue = round2(monthlyRevenue._sum.amount);
  const expenses = round2(monthlyExpenses._sum.amount);

  return {
    view: 'staff',
    properties: { total: totalProperties },
    buildings: { total: totalBuildings },
    units: unitSummary,
    tenants: { total: totalTenants },
    owners: { total: totalOwners },
    occupancyRate: unitSummary.total > 0 ? round2((unitSummary.occupied / unitSummary.total) * 100) : 0,
    leases: { active: activeLeases, expiringNext30Days: expiringLeases },
    finance: {
      outstandingBalance: round2(outstandingBalance._sum.balance),
      monthlyRevenue: revenue,
      monthlyExpenses: expenses,
      monthlyNetIncome: round2(revenue - expenses),
      trend: buildMonthlyTrend(trendPayments, trendExpenses),
    },
    maintenance: { open: openMaintenance, emergency: emergencyMaintenance },
    // Status is included deliberately — the 5 most recent payments can
    // include a refunded/failed one, and hiding that would misrepresent
    // what actually happened on the account.
    recentPayments: recentPayments.map((p) => ({
      id: p.id, amount: p.amount, status: p.status, paymentDate: p.paymentDate,
      tenant: p.tenant ? `${p.tenant.firstName} ${p.tenant.lastName}` : null,
    })),
  };
}

// maintenance_manager view: operational summary only (properties,
// buildings, units, owners, tenants counts, plus maintenance/work-order/
// vendor/inspection detail) — never the financial figures on the staff
// dashboard, since this role holds no invoices/payments/expenses/reports
// permission at all (see constants/permissions.js). Always org-wide:
// maintenance_manager is in ORG_WIDE_PROPERTY_ROLES.
async function getMaintenanceManagerDashboard(organizationId) {
  const now = new Date();
  const upcomingWindowEnd = new Date(now.getTime() + UPCOMING_INSPECTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalProperties, totalBuildings, unitSummary, totalOwners, totalTenants,
    maintenanceByStatus, emergencyOpen, workOrderByStatus, totalVendors,
    upcomingInspections, overdueInspections,
  ] = await Promise.all([
    countPropertiesByOrganization(organizationId, {}),
    countBuildingsByOrganization(organizationId, {}),
    getUnitSummaryForScope(organizationId),
    countOwnersByOrganization(organizationId, {}),
    countTenantsByOrganization(organizationId, {}),
    getMaintenanceRequestStatusSummary(organizationId),
    countMaintenanceRequestsByOrganization(organizationId, { status: OPEN_MAINTENANCE_STATUSES, priority: 'emergency' }),
    getWorkOrderStatusSummary(organizationId),
    countVendorsByOrganization(organizationId, {}),
    countUpcomingInspections(organizationId, { from: now, to: upcomingWindowEnd }),
    countOverdueInspections(organizationId, {}),
  ]);

  const openMaintenance = Object.entries(maintenanceByStatus)
    .filter(([status]) => OPEN_MAINTENANCE_STATUSES.includes(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const openWorkOrders = OPEN_WORK_ORDER_STATUSES.reduce((sum, status) => sum + (workOrderByStatus[status] ?? 0), 0);

  return {
    view: 'maintenance',
    properties: { total: totalProperties },
    buildings: { total: totalBuildings },
    units: unitSummary,
    owners: { total: totalOwners },
    tenants: { total: totalTenants },
    maintenance: { open: openMaintenance, emergency: emergencyOpen, byStatus: maintenanceByStatus },
    workOrders: { open: openWorkOrders, byStatus: workOrderByStatus },
    vendors: { total: totalVendors },
    inspections: { upcoming: upcomingInspections, overdue: overdueInspections },
  };
}

// Tenant view: their own lease/balance/requests only — never the
// organization-wide figures above, even if they somehow held
// `reports:read` (they don't, by default template — see
// constants/permissions.js).
async function getTenantDashboard(organizationId, tenantId) {
  const [outstandingBalance, openMaintenance, recentPayments] = await Promise.all([
    sumOutstandingBalance(organizationId, { tenantId }),
    countMaintenanceRequestsByOrganization(organizationId, { status: OPEN_MAINTENANCE_STATUSES, tenantId }),
    findPaymentsByOrganization(organizationId, { skip: 0, take: 5, tenantId }),
  ]);

  return {
    view: 'tenant',
    finance: { outstandingBalance: round2(outstandingBalance._sum.balance) },
    maintenance: { open: openMaintenance },
    recentPayments: recentPayments.map((p) => ({ id: p.id, amount: p.amount, status: p.status, paymentDate: p.paymentDate })),
  };
}

export async function getDashboard(organizationId, actingUser) {
  if (actingUser.roles.includes('tenant')) {
    const tenant = await findTenantByUserId(actingUser.id, organizationId);
    return getTenantDashboard(organizationId, tenant?.id ?? NO_MATCH_ID);
  }

  if (actingUser.roles.includes('maintenance_manager') && !actingUser.roles.some((r) => RICHER_DASHBOARD_ROLES.includes(r))) {
    return getMaintenanceManagerDashboard(organizationId);
  }

  const scope = await getRestrictedScope(actingUser, organizationId);
  return getStaffDashboard(organizationId, scope.propertyIds);
}
