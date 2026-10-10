import { deleteDocumentsFor } from './recordCleanup.service.js';
import { sendMail } from '../integrations/email/mailer.js';
import { maintenanceAssignedVendorEmail, maintenanceAssignedTenantEmail } from '../integrations/email/templates.js';
import { findOrganizationById } from '../repositories/organization.repository.js';
import { logger } from '../config/logger.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createMaintenanceRequest, findMaintenanceRequestById, findMaintenanceRequestsByOrganization,
  countMaintenanceRequestsByOrganization, updateMaintenanceRequestStatus, assignMaintenanceRequest,
} from '../repositories/maintenanceRequest.repository.js';
import { findPropertyById } from '../repositories/property.repository.js';
import { findUnitById } from '../repositories/unit.repository.js';
import { findTenantById, findTenantByUserId } from '../repositories/tenant.repository.js';
import { prisma } from '../config/database.js';
import { findUserById } from '../repositories/user.repository.js';
import { assertPropertyAccess, getRestrictedScope } from './resourceAccess.service.js';
import { getCoverImageUrls } from './document.service.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';

const CANCELLABLE_STATUSES = new Set(['open', 'in_review', 'assigned', 'scheduled']);

function serializeMaintenanceRequest(request) {
  return {
    id: request.id,
    propertyId: request.propertyId,
    unitId: request.unitId,
    tenantId: request.tenantId,
    title: request.title,
    description: request.description,
    priority: request.priority,
    status: request.status,
    assignedTo: request.assignedTo,
    vendorId: request.vendorId,
    reportedAt: request.reportedAt,
    resolvedAt: request.resolvedAt,
  };
}

async function loadMaintenanceRequestWithAccess(id, organizationId, actingUser) {
  const request = await findMaintenanceRequestById(id, organizationId);
  if (!request) throw AppError.notFound('Maintenance request not found.');

  if (actingUser.roles.includes('tenant')) {
    const scope = await getRestrictedScope(actingUser, organizationId);
    if (scope.tenantId !== request.tenantId) throw AppError.notFound('Maintenance request not found.');
    return request;
  }
  await assertPropertyAccess(request.property, actingUser);
  return request;
}

export async function listMaintenanceRequests(organizationId, actingUser, { page, pageSize, skip, take, status, priority, propertyId, tenantId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const effectiveTenantId = scope.tenantId ?? tenantId;
  const propertyIds = scope.propertyIds;

  const [requests, total] = await Promise.all([
    findMaintenanceRequestsByOrganization(organizationId, { skip, take, status, priority, propertyId, tenantId: effectiveTenantId, propertyIds }),
    countMaintenanceRequestsByOrganization(organizationId, { status, priority, propertyId, tenantId: effectiveTenantId, propertyIds }),
  ]);
  const coverUrls = await getCoverImageUrls(organizationId, 'maintenance_request', requests.map((r) => r.id));
  return {
    requests: requests.map((r) => ({ ...serializeMaintenanceRequest(r), coverImageUrl: coverUrls.get(r.id) ?? null })),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getMaintenanceRequest(id, organizationId, actingUser) {
  const request = await loadMaintenanceRequestWithAccess(id, organizationId, actingUser);
  const assignee = request.assignedTo
    ? await prisma.user.findFirst({ where: { id: request.assignedTo, organizationId }, select: { firstName: true, lastName: true } })
    : null;
  const vendor = request.vendorId
    ? await prisma.vendor.findFirst({ where: { id: request.vendorId, organizationId }, select: { id: true, name: true, serviceType: true, phone: true, email: true } })
    : null;
  return {
    ...serializeMaintenanceRequest(request),
    propertyName: request.property?.name ?? null,
    unitNumber: request.unit && !request.unit.isWhole ? request.unit.unitNumber : null,
    tenant: request.tenant ? { name: `${request.tenant.firstName} ${request.tenant.lastName}`.trim(), email: request.tenant.email, phone: request.tenant.phone } : null,
    assignedToName: vendor ? vendor.name : assignee ? `${assignee.firstName} ${assignee.lastName}`.trim() : null,
    vendor,
  };
}

// A tenant reporting an issue is always scoped to themself and to a unit
// they actually have (or had) a lease on — they can't file a request
// against an arbitrary unit just by knowing its id. Staff (property_manager/
// maintenance_manager/administrator) instead specify the property directly
// and may optionally attach a unit/tenant.
export async function createMaintenanceRequestRecord(organizationId, body, actingUser, req) {
  let propertyId = body.propertyId;
  let tenantId = body.tenantId ?? null;
  const unitId = body.unitId ?? null;

  if (actingUser.roles.includes('tenant')) {
    const tenant = await findTenantByUserId(actingUser.id, organizationId);
    if (!tenant) throw AppError.forbidden('No tenant profile is associated with your account.');
    if (!unitId) throw AppError.badRequest('unitId is required.');

    const unit = await findUnitById(unitId, organizationId);
    if (!unit) throw AppError.badRequest('The specified unit does not exist in this organization.');

    // A tenant can only report issues for a place registered to them: a unit
    // they rent, or a unit inside a building they rent.
    const covered = await prisma.tenantRental.findFirst({
      where: {
        tenantId: tenant.id, status: 'active',
        OR: [{ unitId }, { buildingId: unit.buildingId, unitId: null }],
      },
    });
    if (!covered) throw AppError.badRequest('You can only report issues for properties registered to you.');

    tenantId = tenant.id;
    propertyId = unit.building.propertyId;
  } else {
    if (!propertyId) throw AppError.badRequest('propertyId is required.');
    const property = await findPropertyById(propertyId, organizationId);
    if (!property) throw AppError.badRequest('The specified property does not exist in this organization.');
    await assertPropertyAccess(property, actingUser);

    if (unitId) {
      const unit = await findUnitById(unitId, organizationId);
      if (!unit || unit.building.propertyId !== propertyId) throw AppError.badRequest('The specified unit does not belong to this property.');
    }
    if (tenantId) {
      const tenant = await findTenantById(tenantId, organizationId);
      if (!tenant) throw AppError.badRequest('The specified tenant does not exist in this organization.');
    }
  }

  const request = await createMaintenanceRequest({
    organizationId,
    propertyId,
    unitId,
    tenantId,
    title: body.title,
    description: body.description ?? null,
    priority: body.priority ?? 'medium',
    status: 'open',
  });

  await audit({ organizationId, userId: actingUser.id, action: 'maintenance_request.created', entityType: 'maintenance_request', entityId: request.id, newValues: { title: request.title, priority: request.priority }, req });
  return getMaintenanceRequest(request.id, organizationId, actingUser);
}

export async function reviewMaintenanceRequest(id, organizationId, actingUser, req) {
  const request = await loadMaintenanceRequestWithAccess(id, organizationId, actingUser);
  if (request.status !== 'open') throw AppError.conflict(`Only an open request can be moved to review (current status: ${request.status}).`);

  await updateMaintenanceRequestStatus(id, 'in_review');
  await audit({ organizationId, userId: actingUser.id, action: 'maintenance_request.reviewed', entityType: 'maintenance_request', entityId: id, newValues: { status: 'in_review' }, req });
  return getMaintenanceRequest(id, organizationId, actingUser);
}

// Words in a request that point at a kind of work (so the matching vendors
// can be listed first).
const keywords = (text) => (text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

// The active vendors an organization has, the ones whose service matches the
// request (by its words) listed first and flagged as suggested.
export async function listVendorsForRequest(id, organizationId, actingUser) {
  const request = await loadMaintenanceRequestWithAccess(id, organizationId, actingUser);
  const vendors = await prisma.vendor.findMany({ where: { organizationId, status: 'active' }, orderBy: { name: 'asc' } });
  const words = new Set(keywords(`${request.title} ${request.description ?? ''}`));
  const stem = (w) => w.replace(/(ing|er|ers|s|es)$/, '');
  const list = vendors.map((v) => {
    const serviceWords = keywords(v.serviceType).map(stem);
    const suggested = serviceWords.some((sw) => sw.length > 2 && [...words].some((w) => stem(w) === sw || w.includes(sw) || sw.includes(stem(w))));
    return { id: v.id, name: v.name, serviceType: v.serviceType, contactPerson: v.contactPerson, email: v.email, phone: v.phone, suggested };
  });
  list.sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.name.localeCompare(b.name));
  return list;
}

// A maintenance request is assigned to a vendor. The vendor and the tenant
// who reported it are both emailed, and the tenant is also notified in the app.
export async function assignMaintenanceRequestRecord(id, organizationId, vendorId, actingUser, req) {
  const request = await loadMaintenanceRequestWithAccess(id, organizationId, actingUser);
  if (!['open', 'in_review'].includes(request.status)) {
    throw AppError.conflict(`Cannot assign a request with status "${request.status}".`);
  }

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, organizationId } });
  if (!vendor) throw AppError.badRequest('That vendor does not exist in this organization.');
  if (vendor.status !== 'active') throw AppError.conflict('That vendor is not active.');

  await prisma.maintenanceRequest.update({ where: { id }, data: { vendorId, assignedTo: null, status: 'assigned' } });
  await audit({ organizationId, userId: actingUser.id, action: 'maintenance_request.assigned', entityType: 'maintenance_request', entityId: id, newValues: { vendorId }, req });

  const organization = await findOrganizationById(organizationId);
  const propertyName = request.property?.name ?? 'the property';
  const unitLabel = request.unit && !request.unit.isWhole ? `Unit ${request.unit.unitNumber}` : null;
  const tenant = request.tenant ? { name: `${request.tenant.firstName} ${request.tenant.lastName}`.trim(), email: request.tenant.email, phone: request.tenant.phone } : null;

  if (vendor.email) {
    const mail = maintenanceAssignedVendorEmail({ org: organization, vendor, request, propertyName, unitLabel, tenant });
    await sendMail({ to: vendor.email, ...mail }).catch((err) => logger.warn({ err: err.message }, 'vendor assignment email failed'));
  }
  if (tenant?.email) {
    const mail = maintenanceAssignedTenantEmail({ org: organization, firstName: request.tenant.firstName, request, vendor });
    await sendMail({ to: tenant.email, ...mail }).catch((err) => logger.warn({ err: err.message }, 'tenant assignment email failed'));
  }
  if (request.tenant?.userId) {
    await notify({
      organizationId, userId: request.tenant.userId, type: 'maintenance_assigned',
      title: 'Your maintenance request has been assigned', message: `"${request.title}" was assigned to ${vendor.name}. They will contact you.`,
    });
  }
  return getMaintenanceRequest(id, organizationId, actingUser);
}

export async function cancelMaintenanceRequest(id, organizationId, actingUser, req) {
  const request = await loadMaintenanceRequestWithAccess(id, organizationId, actingUser);
  if (!CANCELLABLE_STATUSES.has(request.status)) {
    throw AppError.conflict(`Cannot cancel a request with status "${request.status}".`);
  }

  await updateMaintenanceRequestStatus(id, 'cancelled');
  await audit({ organizationId, userId: actingUser.id, action: 'maintenance_request.cancelled', entityType: 'maintenance_request', entityId: id, oldValues: { status: request.status }, newValues: { status: 'cancelled' }, req });
  return getMaintenanceRequest(id, organizationId, actingUser);
}

// Used by work-order.service.js to cascade status as work actually
// progresses — a maintenance request's status should always reflect the
// real-world state of the work being done on it, not be edited by hand
// once a work order exists.
export async function cascadeMaintenanceRequestStatus(id, status, extra = {}) {
  return updateMaintenanceRequestStatus(id, status, extra);
}

// Permanently removes a maintenance request, its work orders (cascade) and
// its attachments.
export async function deleteMaintenanceRequest(id, organizationId, actingUser, req) {
  const request = await loadMaintenanceRequestWithAccess(id, organizationId, actingUser);
  await deleteDocumentsFor(organizationId, 'maintenance_request', id);
  await prisma.maintenanceRequest.delete({ where: { id: request.id } });
  await audit({ organizationId, userId: actingUser.id, action: 'maintenance_request.deleted', entityType: 'maintenance_request', entityId: null, oldValues: { title: request.title }, req });
  return { deleted: true };
}
