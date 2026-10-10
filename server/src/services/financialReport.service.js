import { sumCompletedPayments } from '../repositories/payment.repository.js';
import { sumApprovedExpenses } from '../repositories/expense.repository.js';
import { getUnitSummaryForScope } from '../repositories/unit.repository.js';
import { countPropertiesByOrganization } from '../repositories/property.repository.js';
import { findInvoicesByOrganization, countInvoicesByOrganization } from '../repositories/invoice.repository.js';
import { countMaintenanceRequestsByOrganization } from '../repositories/maintenanceRequest.repository.js';
import { getRestrictedScope } from './resourceAccess.service.js';

function resolvePropertyIds(scope, propertyId) {
  return scope.propertyIds ?? (propertyId ? [propertyId] : undefined);
}

// A first, deliberately simple financial report: revenue vs. expenses over
// an optional date range, scoped the same way every other finance listing
// is (self/assignment/ownership/org-wide). PDF/CSV export and richer
// breakdowns (by property, by category, month-over-month) are documented as
// not yet implemented — see docs/api/api-guide.md.
export async function getFinancialSummary(organizationId, actingUser, { propertyId, from, to }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  // An explicit `propertyId` query filter is honored for org-wide roles;
  // restricted roles are always confined to their own scope regardless of
  // what's requested.
  const propertyIds = resolvePropertyIds(scope, propertyId);

  const [revenueResult, expenseResult] = await Promise.all([
    sumCompletedPayments(organizationId, { propertyIds, from, to }),
    sumApprovedExpenses(organizationId, { propertyIds, from, to }),
  ]);

  const revenue = Number(revenueResult._sum.amount ?? 0);
  const expenses = Number(expenseResult._sum.amount ?? 0);

  return {
    period: { from: from ?? null, to: to ?? null },
    revenue,
    expenses,
    netIncome: Math.round((revenue - expenses) * 100) / 100,
  };
}

// Unit occupancy across the caller's scope — a lighter-weight companion to
// the per-property summary already embedded in GET /properties/:id.
export async function getOccupancyReport(organizationId, actingUser, { propertyId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = resolvePropertyIds(scope, propertyId);

  const [propertyCount, unitSummary] = await Promise.all([
    countPropertiesByOrganization(organizationId, { propertyIds }),
    getUnitSummaryForScope(organizationId, propertyIds),
  ]);

  return {
    properties: propertyCount,
    units: unitSummary,
    occupancyRate: unitSummary.total > 0 ? Math.round((unitSummary.occupied / unitSummary.total) * 10000) / 100 : 0,
  };
}

// Invoice status breakdown for a period — how much is billed, collected,
// and still outstanding, plus a simple count per status.
export async function getRentCollectionReport(organizationId, actingUser, { propertyId, from, to }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = resolvePropertyIds(scope, propertyId);

  const statuses = ['draft', 'sent', 'partially_paid', 'paid', 'overdue', 'void'];
  const counts = await Promise.all(
    statuses.map((status) => countInvoicesByOrganization(organizationId, { status, propertyIds }))
  );

  // Total billed/collected/outstanding is computed from the actual rows
  // rather than a second aggregate query, since we need per-status counts
  // here anyway and the row set for a single organization's period is
  // small enough to sum in memory without a dedicated SQL aggregate.
  //
  // `void` invoices are excluded from all three totals, not just
  // "outstanding" — a voided invoice was never a real billed/collectible
  // amount (that's the whole point of voiding it), so it shouldn't inflate
  // gross billed either. It still counts in `byStatus` for visibility.
  const invoices = await findInvoicesByOrganization(organizationId, { skip: 0, take: 1000, propertyIds });
  const inRange = (date) => (!from || date >= from) && (!to || date <= to);
  const relevant = invoices.filter((inv) => inRange(inv.issueDate) && inv.status !== 'void');

  const totalBilled = relevant.reduce((sum, inv) => sum + Number(inv.total), 0);
  const totalCollected = relevant.reduce((sum, inv) => sum + Number(inv.amountPaid), 0);
  const totalOutstanding = relevant.reduce((sum, inv) => sum + Number(inv.balance), 0);

  return {
    period: { from: from ?? null, to: to ?? null },
    byStatus: Object.fromEntries(statuses.map((status, i) => [status, counts[i]])),
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
  };
}

// Maintenance request volume by status and priority — a quick operational
// pulse check, not a full ticket-level export.
export async function getMaintenanceSummaryReport(organizationId, actingUser, { propertyId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = resolvePropertyIds(scope, propertyId);

  const statuses = ['open', 'in_review', 'assigned', 'scheduled', 'in_progress', 'completed', 'cancelled'];
  const priorities = ['low', 'medium', 'high', 'emergency'];

  const [statusCounts, priorityCounts] = await Promise.all([
    Promise.all(statuses.map((status) => countMaintenanceRequestsByOrganization(organizationId, { status, propertyIds }))),
    Promise.all(priorities.map((priority) => countMaintenanceRequestsByOrganization(organizationId, { priority, propertyIds }))),
  ]);

  return {
    byStatus: Object.fromEntries(statuses.map((status, i) => [status, statusCounts[i]])),
    byPriority: Object.fromEntries(priorities.map((priority, i) => [priority, priorityCounts[i]])),
  };
}
