import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createWorkOrder, findWorkOrderById, findWorkOrdersByMaintenanceRequest, findWorkOrdersByOrganization,
  countWorkOrdersByOrganization, updateWorkOrder, setWorkOrderStatus,
} from '../repositories/workOrder.repository.js';
import { findMaintenanceRequestById } from '../repositories/maintenanceRequest.repository.js';
import { findVendorById } from '../repositories/vendor.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { findExpenseCategoriesByOrganization } from '../repositories/expenseCategory.repository.js';
import { createExpense } from '../repositories/expense.repository.js';
import { assertPropertyAccess, getRestrictedScope } from './resourceAccess.service.js';
import { cascadeMaintenanceRequestStatus } from './maintenanceRequest.service.js';
import { getCoverImageUrls } from './document.service.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { logger } from '../config/logger.js';

function serializeWorkOrder(workOrder) {
  return {
    id: workOrder.id,
    maintenanceRequestId: workOrder.maintenanceRequestId,
    vendorId: workOrder.vendorId,
    assignedStaffId: workOrder.assignedStaffId,
    scheduledDate: workOrder.scheduledDate,
    completedDate: workOrder.completedDate,
    estimatedCost: workOrder.estimatedCost,
    actualCost: workOrder.actualCost,
    status: workOrder.status,
  };
}

async function loadWorkOrderWithAccess(id, organizationId, actingUser) {
  const workOrder = await findWorkOrderById(id, organizationId);
  if (!workOrder) throw AppError.notFound('Work order not found.');
  await assertPropertyAccess(workOrder.maintenanceRequest.property, actingUser);
  return workOrder;
}

// Tenants never see work orders (no `work-orders:read` in their permission
// template) — this listing only ever needs assignment/ownership/org-wide
// property scoping, never the tenant self-scope branch.
export async function listWorkOrders(organizationId, actingUser, { page, pageSize, skip, take, status, vendorId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = scope.propertyIds;

  const [workOrders, total] = await Promise.all([
    findWorkOrdersByOrganization(organizationId, { skip, take, status, vendorId, propertyIds }),
    countWorkOrdersByOrganization(organizationId, { status, vendorId, propertyIds }),
  ]);
  const coverUrls = await getCoverImageUrls(organizationId, 'work_order', workOrders.map((w) => w.id));
  return {
    workOrders: workOrders.map((w) => ({ ...serializeWorkOrder(w), coverImageUrl: coverUrls.get(w.id) ?? null })),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function listWorkOrdersForMaintenanceRequest(maintenanceRequestId, organizationId, actingUser) {
  const request = await findMaintenanceRequestById(maintenanceRequestId, organizationId);
  if (!request) throw AppError.notFound('Maintenance request not found.');
  await assertPropertyAccess(request.property, actingUser);

  const workOrders = await findWorkOrdersByMaintenanceRequest(maintenanceRequestId, organizationId);
  return workOrders.map(serializeWorkOrder);
}

export async function getWorkOrder(id, organizationId, actingUser) {
  const workOrder = await loadWorkOrderWithAccess(id, organizationId, actingUser);
  return serializeWorkOrder(workOrder);
}

// Creating a work order is how a request moves from "assigned" into an
// actual scheduled/in-progress state of work — it requires the parent
// maintenance request to already be assigned, and immediately advances it
// to `scheduled` when a scheduled date is given.
export async function createWorkOrderRecord(maintenanceRequestId, organizationId, body, actingUser, req) {
  const request = await findMaintenanceRequestById(maintenanceRequestId, organizationId);
  if (!request) throw AppError.notFound('Maintenance request not found.');
  await assertPropertyAccess(request.property, actingUser);
  if (!['assigned', 'scheduled'].includes(request.status)) {
    throw AppError.conflict(`A work order can only be created once the request is assigned (current status: ${request.status}).`);
  }

  if (body.vendorId) {
    const vendor = await findVendorById(body.vendorId, organizationId);
    if (!vendor) throw AppError.badRequest('The specified vendor does not exist in this organization.');
  }
  if (body.assignedStaffId) {
    const staff = await findUserById(body.assignedStaffId, organizationId);
    if (!staff) throw AppError.badRequest('The specified staff member does not exist in this organization.');
  }

  const workOrder = await createWorkOrder({
    organizationId,
    maintenanceRequestId,
    vendorId: body.vendorId ?? null,
    assignedStaffId: body.assignedStaffId ?? null,
    scheduledDate: body.scheduledDate ?? null,
    estimatedCost: body.estimatedCost ?? null,
    status: body.scheduledDate ? 'scheduled' : 'pending',
  });

  if (body.scheduledDate && request.status !== 'scheduled') {
    await cascadeMaintenanceRequestStatus(maintenanceRequestId, 'scheduled');
  }

  await audit({ organizationId, userId: actingUser.id, action: 'work_order.created', entityType: 'work_order', entityId: workOrder.id, newValues: { maintenanceRequestId, vendorId: body.vendorId }, req });
  return getWorkOrder(workOrder.id, organizationId, actingUser);
}

export async function updateWorkOrderRecord(id, organizationId, body, actingUser, req) {
  const workOrder = await loadWorkOrderWithAccess(id, organizationId, actingUser);
  if (['completed', 'cancelled'].includes(workOrder.status)) {
    throw AppError.conflict(`A ${workOrder.status} work order cannot be edited.`);
  }

  await updateWorkOrder(id, body);
  await audit({ organizationId, userId: actingUser.id, action: 'work_order.updated', entityType: 'work_order', entityId: id, newValues: body, req });
  return getWorkOrder(id, organizationId, actingUser);
}

export async function startWorkOrder(id, organizationId, actingUser, req) {
  const workOrder = await loadWorkOrderWithAccess(id, organizationId, actingUser);
  if (!['pending', 'scheduled'].includes(workOrder.status)) {
    throw AppError.conflict(`Only a pending or scheduled work order can be started (current status: ${workOrder.status}).`);
  }

  await setWorkOrderStatus(id, 'in_progress');
  await cascadeMaintenanceRequestStatus(workOrder.maintenanceRequestId, 'in_progress');

  await audit({ organizationId, userId: actingUser.id, action: 'work_order.started', entityType: 'work_order', entityId: id, newValues: { status: 'in_progress' }, req });
  return getWorkOrder(id, organizationId, actingUser);
}

// Completing a work order closes out the parent maintenance request too
// (§33's workflow ends at "Close") and, when an actual cost is recorded,
// automatically drafts a matching Expense so a maintenance cost never has
// to be re-entered by hand into the finance module — it's created as
// `pending_approval` like any other expense, so it still goes through the
// normal approval workflow from Phase 8. If no "Maintenance" category
// exists in this organization (e.g. renamed or removed), the expense step
// is skipped rather than failing the completion itself — recording that
// the work is done must never be blocked by bookkeeping.
export async function completeWorkOrder(id, organizationId, body, actingUser, req) {
  const workOrder = await loadWorkOrderWithAccess(id, organizationId, actingUser);
  if (workOrder.status !== 'in_progress') {
    throw AppError.conflict(`Only an in-progress work order can be completed (current status: ${workOrder.status}).`);
  }

  const actualCost = body.actualCost ?? null;
  await setWorkOrderStatus(id, 'completed', { completedDate: new Date(), actualCost });
  await cascadeMaintenanceRequestStatus(workOrder.maintenanceRequestId, 'completed', { resolvedAt: new Date() });

  if (actualCost !== null) {
    try {
      const categories = await findExpenseCategoriesByOrganization(organizationId);
      const maintenanceCategory = categories.find((c) => c.name === 'Maintenance');
      if (maintenanceCategory) {
        await createExpense({
          organizationId,
          propertyId: workOrder.maintenanceRequest.propertyId,
          categoryId: maintenanceCategory.id,
          vendorId: workOrder.vendorId,
          amount: actualCost,
          currency: 'USD',
          expenseDate: new Date(),
          description: `Work order completion — maintenance request ${workOrder.maintenanceRequestId}`,
          status: 'pending_approval',
        });
      }
    } catch (err) {
      logger.error({ err, workOrderId: id }, 'failed to auto-create expense from completed work order');
    }
  }

  await audit({ organizationId, userId: actingUser.id, action: 'work_order.completed', entityType: 'work_order', entityId: id, newValues: { status: 'completed', actualCost }, req });

  const request = await findMaintenanceRequestById(workOrder.maintenanceRequestId, organizationId);
  await notify({
    organizationId, userId: request?.tenant?.userId, type: 'maintenance_completed',
    title: 'Maintenance work completed', message: `The work on "${request?.title}" has been completed.`,
  });

  return getWorkOrder(id, organizationId, actingUser);
}

export async function cancelWorkOrder(id, organizationId, actingUser, req) {
  const workOrder = await loadWorkOrderWithAccess(id, organizationId, actingUser);
  if (!['pending', 'scheduled'].includes(workOrder.status)) {
    throw AppError.conflict(`Only a pending or scheduled work order can be cancelled (current status: ${workOrder.status}).`);
  }

  await setWorkOrderStatus(id, 'cancelled');
  await audit({ organizationId, userId: actingUser.id, action: 'work_order.cancelled', entityType: 'work_order', entityId: id, newValues: { status: 'cancelled' }, req });
  return getWorkOrder(id, organizationId, actingUser);
}

// Only work that never really happened can be deleted; started/completed
// work orders carry real cost history and are cancelled instead.
export async function deleteWorkOrder(id, organizationId, actingUser, req) {
  const workOrder = await loadWorkOrderWithAccess(id, organizationId, actingUser);
  if (!['pending', 'cancelled'].includes(workOrder.status)) {
    throw AppError.conflict('Only pending or cancelled work orders can be deleted. Cancel it first.');
  }
  await prisma.workOrder.delete({ where: { id: workOrder.id } });
  await audit({ organizationId, userId: actingUser.id, action: 'work_order.deleted', entityType: 'work_order', entityId: null, req });
  return { deleted: true };
}
