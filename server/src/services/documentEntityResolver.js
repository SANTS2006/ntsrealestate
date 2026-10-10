import { findOrganizationById } from '../repositories/organization.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { findPropertyById } from '../repositories/property.repository.js';
import { findBuildingById } from '../repositories/building.repository.js';
import { findUnitById } from '../repositories/unit.repository.js';
import { findTenantById } from '../repositories/tenant.repository.js';
import { findOwnerById } from '../repositories/owner.repository.js';
import { findLeaseById } from '../repositories/lease.repository.js';
import { findInvoiceById } from '../repositories/invoice.repository.js';
import { findPaymentById } from '../repositories/payment.repository.js';
import { findExpenseById } from '../repositories/expense.repository.js';
import { findMaintenanceRequestById } from '../repositories/maintenanceRequest.repository.js';
import { findWorkOrderById } from '../repositories/workOrder.repository.js';
import { findInspectionById } from '../repositories/inspection.repository.js';
import { findVendorById } from '../repositories/vendor.repository.js';
import { assertPropertyAccess } from './resourceAccess.service.js';
import { getSalesScope } from './salesScope.service.js';
import { prisma } from '../config/database.js';

// Every document is attached to some other entity (a property, a lease, a
// user's own profile, ...). Before accepting an upload, two things must be
// true: the entity must actually exist and belong to the caller's
// organization (cross-tenant write prevention), AND — now that Phase 7's
// resource-level authorization exists — the caller must actually be allowed
// to touch *that specific* entity, not just hold the generic
// `documents:create` permission. A property_manager who isn't assigned to
// property X can't attach a document to X's file even though they can
// attach one to a property they are assigned to.
//
// Each resolver returns a boolean rather than throwing, so a denial here
// collapses to the same generic 404 every other cross-org/cross-assignment
// mismatch produces (see document.service.js) — never a message that
// distinguishes "doesn't exist" from "exists but you can't touch it."
async function resolverDenied(fn) {
  try {
    return !(await fn());
  } catch {
    return true;
  }
}

const RESOLVERS = {
  organization: async (entityId, organizationId) => {
    if (entityId !== organizationId) return false; // caller's own org only
    return Boolean(await findOrganizationById(entityId));
  },
  user: async (entityId, organizationId) => Boolean(await findUserById(entityId, organizationId)),
  property: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const property = await findPropertyById(entityId, organizationId);
      if (!property) return false;
      await assertPropertyAccess(property, actingUser);
      return true;
    })),
  building: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const building = await findBuildingById(entityId, organizationId);
      if (!building) return false;
      await assertPropertyAccess(building.property, actingUser);
      return true;
    })),
  unit: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const unit = await findUnitById(entityId, organizationId);
      if (!unit) return false;
      await assertPropertyAccess(unit.building.property, actingUser);
      return true;
    })),
  // Lands: administrators and the other organization-wide roles may attach
  // photos/videos to any land; an owner or agent only to lands of their own owner.
  land: async (entityId, organizationId, actingUser) => {
    const land = await prisma.land.findFirst({ where: { id: entityId, organizationId }, select: { ownerId: true } });
    if (!land) return false;
    const scope = await getSalesScope(actingUser, organizationId);
    if (scope.orgWide) return true;
    return Boolean(land.ownerId && scope.ownerIds?.includes(land.ownerId));
  },
  lease: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const lease = await findLeaseById(entityId, organizationId);
      if (!lease) return false;
      if (actingUser.roles.includes('tenant')) return lease.tenant?.userId === actingUser.id;
      await assertPropertyAccess(lease.unit.building.property, actingUser);
      return true;
    })),
  tenant: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const tenant = await findTenantById(entityId, organizationId);
      if (!tenant) return false;
      if (actingUser.roles.includes('tenant')) return tenant.userId === actingUser.id;
      return true; // any other role holding documents:create on tenants is org-wide today
    })),
  owner: async (entityId, organizationId) => Boolean(await findOwnerById(entityId, organizationId)),
  invoice: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const invoice = await findInvoiceById(entityId, organizationId);
      if (!invoice) return false;
      if (actingUser.roles.includes('tenant')) return invoice.tenantId && (await findTenantById(invoice.tenantId, organizationId))?.userId === actingUser.id;
      if (invoice.lease) await assertPropertyAccess(invoice.lease.unit.building.property, actingUser);
      return true;
    })),
  payment: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const payment = await findPaymentById(entityId, organizationId);
      if (!payment) return false;
      if (actingUser.roles.includes('tenant')) return payment.tenantId && (await findTenantById(payment.tenantId, organizationId))?.userId === actingUser.id;
      return true;
    })),
  expense: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const expense = await findExpenseById(entityId, organizationId);
      if (!expense) return false;
      if (expense.propertyId) {
        const property = await findPropertyById(expense.propertyId, organizationId);
        if (property) await assertPropertyAccess(property, actingUser);
      }
      return true;
    })),
  maintenance_request: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const request = await findMaintenanceRequestById(entityId, organizationId);
      if (!request) return false;
      if (actingUser.roles.includes('tenant')) return request.tenantId && (await findTenantById(request.tenantId, organizationId))?.userId === actingUser.id;
      await assertPropertyAccess(request.property, actingUser);
      return true;
    })),
  work_order: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const workOrder = await findWorkOrderById(entityId, organizationId);
      if (!workOrder) return false;
      await assertPropertyAccess(workOrder.maintenanceRequest.property, actingUser);
      return true;
    })),
  inspection: async (entityId, organizationId, actingUser) =>
    !(await resolverDenied(async () => {
      const inspection = await findInspectionById(entityId, organizationId);
      if (!inspection) return false;
      await assertPropertyAccess(inspection.property, actingUser);
      return true;
    })),
  // Vendors are an organization-wide directory (not property-scoped — see
  // vendor.service.js), so any caller holding `documents:create` in this
  // organization may attach a document to any vendor in it.
  vendor: async (entityId, organizationId) => Boolean(await findVendorById(entityId, organizationId)),
};

// Every entity type in the requirements now has a resolver — the
// upload/download/delete flow in document.service.js never needs to change
// as new entity types are added; each just gets one more entry here.
export function isKnownEntityType(entityType) {
  return entityType in RESOLVERS;
}

export async function entityBelongsToOrganization(entityType, entityId, organizationId, actingUser) {
  const resolver = RESOLVERS[entityType];
  if (!resolver) return false;
  return resolver(entityId, organizationId, actingUser);
}
