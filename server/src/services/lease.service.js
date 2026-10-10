import { prisma } from '../config/database.js';
import { unitTitle } from '../utils/unitLabel.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createLease, findLeaseById, findLeasesByOrganization, countLeasesByOrganization,
  findActiveLeaseForUnit, updateLeaseStatus, updateLease,
} from '../repositories/lease.repository.js';
import { findUnitById, setUnitStatus } from '../repositories/unit.repository.js';
import { findTenantById, findTenantByUserId } from '../repositories/tenant.repository.js';
import { findOwnerById } from '../repositories/owner.repository.js';
import { findAssignmentsForProperty } from '../repositories/propertyAssignment.repository.js';
import { assertPropertyAccess, getRestrictedScope, ORG_WIDE_PROPERTY_ROLES } from './resourceAccess.service.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';

const IMMUTABLE_STATUSES = new Set(['terminated', 'expired', 'renewed']);

function serializeLease(lease) {
  return {
    id: lease.id,
    unitId: lease.unitId,
    tenantId: lease.tenantId,
    startDate: lease.startDate,
    endDate: lease.endDate,
    monthlyRent: lease.monthlyRent,
    securityDeposit: lease.securityDeposit,
    paymentDueDay: lease.paymentDueDay,
    renewalDate: lease.renewalDate,
    status: lease.status,
    terms: lease.terms,
    createdAt: lease.createdAt,
    updatedAt: lease.updatedAt,
    ...(lease.tenant ? { tenant: { id: lease.tenant.id, firstName: lease.tenant.firstName, lastName: lease.tenant.lastName } } : {}),
    ...(lease.unit ? { unit: { id: lease.unit.id, unitNumber: lease.unit.unitNumber, propertyId: lease.unit.building.propertyId, title: unitTitle(lease.unit), propertyName: lease.unit.building.property.name } } : {}),
  };
}

function hasAnyRole(actingUser, roleSet) {
  return actingUser.roles.some((r) => roleSet.has(r));
}

// Loaded lease + full resource-level check: a tenant sees only their own
// lease; an owner only leases on their own properties; a property_manager/
// agent only leases on properties they're assigned to; everyone else with
// `leases:*` operates organization-wide. Mirrors assertPropertyAccess's
// shape but adds the tenant-specific branch leases (unlike bare properties)
// need.
async function loadLeaseWithAccess(id, organizationId, actingUser) {
  const lease = await findLeaseById(id, organizationId);
  if (!lease) throw AppError.notFound('Lease not found.');

  if (actingUser.roles.includes('tenant') && !hasAnyRole(actingUser, ORG_WIDE_PROPERTY_ROLES)) {
    const tenant = await findTenantByUserId(actingUser.id, organizationId);
    if (!tenant || tenant.id !== lease.tenantId) throw AppError.notFound('Lease not found.');
    return lease;
  }

  await assertPropertyAccess(lease.unit.building.property, actingUser);
  return lease;
}

export async function listLeases(organizationId, actingUser, { page, pageSize, skip, take, status, tenantId, unitId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const effectiveTenantId = scope.tenantId ?? tenantId;
  const propertyIds = scope.propertyIds;

  const [leases, total] = await Promise.all([
    findLeasesByOrganization(organizationId, { skip, take, status, tenantId: effectiveTenantId, unitId, propertyIds }),
    countLeasesByOrganization(organizationId, { status, tenantId: effectiveTenantId, unitId, propertyIds }),
  ]);

  return { leases: leases.map(serializeLease), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getLease(id, organizationId, actingUser) {
  const lease = await loadLeaseWithAccess(id, organizationId, actingUser);
  return serializeLease(lease);
}

export async function createLeaseRecord(organizationId, body, actingUser, req) {
  const unit = await findUnitById(body.unitId, organizationId);
  if (!unit) throw AppError.badRequest('The specified unit does not exist in this organization.');
  await assertPropertyAccess(unit.building.property, actingUser);

  const tenant = await findTenantById(body.tenantId, organizationId);
  if (!tenant) throw AppError.badRequest('The specified tenant does not exist in this organization.');

  // Always created as `draft` — a lease only becomes `active` (and only
  // then reserves the unit) through the explicit activation step below,
  // so there is never a moment where a half-filled-out lease silently
  // blocks a unit.
  const lease = await createLease({
    organizationId,
    unitId: body.unitId,
    tenantId: body.tenantId,
    startDate: body.startDate,
    endDate: body.endDate,
    monthlyRent: body.monthlyRent,
    securityDeposit: body.securityDeposit ?? null,
    paymentDueDay: body.paymentDueDay ?? 1,
    terms: body.terms ?? null,
    status: 'draft',
  });

  await audit({ organizationId, userId: actingUser.id, action: 'lease.created', entityType: 'lease', entityId: lease.id, newValues: { unitId: body.unitId, tenantId: body.tenantId }, req });
  return getLease(lease.id, organizationId, actingUser);
}

export async function updateLeaseRecord(id, organizationId, body, actingUser, req) {
  const lease = await loadLeaseWithAccess(id, organizationId, actingUser);
  if (IMMUTABLE_STATUSES.has(lease.status)) {
    throw AppError.conflict(`A ${lease.status} lease cannot be edited — historical lease records are immutable.`);
  }

  await updateLease(id, body);
  await audit({ organizationId, userId: actingUser.id, action: 'lease.updated', entityType: 'lease', entityId: id, newValues: body, req });
  return getLease(id, organizationId, actingUser);
}

// The core "no double-booking" business rule (§28/§73 of the requirements):
// enforced here in a transaction (check-then-act) AND again at the database
// level via the partial unique index on leases(unit_id) WHERE
// status='active' (see prisma/migrations) — belt and suspenders against a
// race between two concurrent activation requests for the same unit.
export async function activateLease(id, organizationId, actingUser, req) {
  const lease = await loadLeaseWithAccess(id, organizationId, actingUser);
  if (lease.status !== 'draft') {
    throw AppError.conflict(`Only a draft lease can be activated (current status: ${lease.status}).`);
  }

  try {
    await prisma.$transaction(async (tx) => {
      const conflicting = await findActiveLeaseForUnit(lease.unitId, tx);
      if (conflicting) {
        throw AppError.conflict('This unit already has another active lease.');
      }
      await updateLeaseStatus(id, 'active', {}, tx);
      await setUnitStatus(lease.unitId, 'occupied', tx);
    });
  } catch (err) {
    if (err?.code === 'P2002') throw AppError.conflict('This unit already has another active lease.');
    throw err;
  }

  await audit({ organizationId, userId: actingUser.id, action: 'lease.activated', entityType: 'lease', entityId: id, newValues: { status: 'active' }, req });
  await notifyLeaseActivated(organizationId, lease);
  return getLease(id, organizationId, actingUser);
}

// Notifies everyone with a real stake in the unit going active: the
// tenant, the property's owner (if any), and every agent assigned to the
// property. Each notify() call is independently fail-safe, so one bad
// email/insert never blocks the others.
async function notifyLeaseActivated(organizationId, lease) {
  const property = lease.unit.building.property;
  const message = `The lease for Unit ${lease.unit.unitNumber} at ${property.name} is now active.`;

  if (lease.tenant?.userId) {
    await notify({ organizationId, userId: lease.tenant.userId, type: 'lease_activated', title: 'Your lease is now active', message: `Your lease for Unit ${lease.unit.unitNumber} at ${property.name} is now active.` });
  }

  if (property.ownerId) {
    const owner = await findOwnerById(property.ownerId, organizationId);
    if (owner?.userId) {
      await notify({ organizationId, userId: owner.userId, type: 'lease_activated', title: 'Lease activated', message });
    }
  }

  const assignments = await findAssignmentsForProperty(property.id, organizationId);
  for (const assignment of assignments) {
    await notify({ organizationId, userId: assignment.userId, type: 'lease_activated', title: 'Lease activated', message });
  }
}

export async function terminateLease(id, organizationId, body, actingUser, req) {
  const lease = await loadLeaseWithAccess(id, organizationId, actingUser);
  if (lease.status !== 'active') {
    throw AppError.conflict(`Only an active lease can be terminated (current status: ${lease.status}).`);
  }

  await prisma.$transaction(async (tx) => {
    await updateLeaseStatus(id, 'terminated', { terms: body?.reason ? { ...lease.terms, terminationReason: body.reason } : lease.terms }, tx);
    await setUnitStatus(lease.unitId, 'available', tx);
  });

  await audit({ organizationId, userId: actingUser.id, action: 'lease.terminated', entityType: 'lease', entityId: id, oldValues: { status: 'active' }, newValues: { status: 'terminated' }, req });
  return getLease(id, organizationId, actingUser);
}

// Renewal never mutates the existing (now-historical) lease's core terms in
// place — it closes the old row out as `renewed` and creates a new `active`
// lease row, preserving a full audit trail of what was actually agreed at
// each point (§53/§73: don't silently overwrite historical records). The
// unit was already `occupied` and stays that way throughout.
export async function renewLease(id, organizationId, body, actingUser, req) {
  const lease = await loadLeaseWithAccess(id, organizationId, actingUser);
  if (lease.status !== 'active') {
    throw AppError.conflict(`Only an active lease can be renewed (current status: ${lease.status}).`);
  }

  const newLease = await prisma.$transaction(async (tx) => {
    await updateLeaseStatus(id, 'renewed', { renewalDate: new Date() }, tx);
    return createLease({
      organizationId,
      unitId: lease.unitId,
      tenantId: lease.tenantId,
      startDate: body.startDate ?? lease.endDate,
      endDate: body.endDate,
      monthlyRent: body.monthlyRent ?? lease.monthlyRent,
      securityDeposit: body.securityDeposit ?? lease.securityDeposit,
      paymentDueDay: body.paymentDueDay ?? lease.paymentDueDay,
      terms: lease.terms,
      status: 'active',
    }, tx);
  });

  await audit({ organizationId, userId: actingUser.id, action: 'lease.renewed', entityType: 'lease', entityId: id, newValues: { renewedAsLeaseId: newLease.id }, req });
  return getLease(newLease.id, organizationId, actingUser);
}
