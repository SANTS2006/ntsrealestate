import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createInspection, findInspectionById, findInspectionsByOrganization, countInspectionsByOrganization,
  updateInspection, setInspectionStatus,
} from '../repositories/inspection.repository.js';
import { findPropertyById } from '../repositories/property.repository.js';
import { findUnitById } from '../repositories/unit.repository.js';
import { findUserById } from '../repositories/user.repository.js';
import { findTenantByUnitId } from '../repositories/tenant.repository.js';
import { assertPropertyAccess, getRestrictedScope } from './resourceAccess.service.js';
import { getCoverImageUrls } from './document.service.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';
import { prisma } from '../config/database.js';
import { sendMail } from '../integrations/email/mailer.js';
import { findOrganizationById } from '../repositories/organization.repository.js';
import { inspectionScheduledEmail } from '../integrations/email/templates.js';
import { logger } from '../config/logger.js';

function serializeInspection(inspection) {
  return {
    id: inspection.id,
    propertyId: inspection.propertyId,
    unitId: inspection.unitId,
    buildingId: inspection.buildingId,
    scope: inspection.unitId ? (inspection.unit?.isWhole ? 'property' : 'unit') : inspection.buildingId ? 'building' : 'property',
    targetLabel: targetLabel(inspection),
    inspectorId: inspection.inspectorId,
    inspectionDate: inspection.inspectionDate,
    type: inspection.type,
    condition: inspection.condition,
    notes: inspection.notes,
    status: inspection.status,
    propertyName: inspection.property?.name ?? null,
    unitNumber: inspection.unit && !inspection.unit.isWhole ? inspection.unit.unitNumber : null,
    buildingName: inspection.building && !inspection.building.isImplicit ? inspection.building.name : null,
  };
}

// What was inspected, in words: the whole property, a building, or a unit.
function targetLabel(i) {
  const property = i.property?.name ?? 'Property';
  if (i.unitId && i.unit && !i.unit.isWhole) return `${property} — ${i.building && !i.building.isImplicit ? `${i.building.name}, ` : ''}Unit ${i.unit.unitNumber}`;
  if (i.building && !i.building.isImplicit) return `${property} — ${i.building.name}`;
  return `${property} — whole property`;
}

async function loadInspectionWithAccess(id, organizationId, actingUser) {
  const inspection = await findInspectionById(id, organizationId);
  if (!inspection) throw AppError.notFound('Inspection not found.');
  await assertPropertyAccess(inspection.property, actingUser);
  return inspection;
}

export async function listInspections(organizationId, actingUser, { page, pageSize, skip, take, status, type, propertyId }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = scope.propertyIds;

  const [inspections, total] = await Promise.all([
    findInspectionsByOrganization(organizationId, { skip, take, status, type, propertyId, propertyIds }),
    countInspectionsByOrganization(organizationId, { status, type, propertyId, propertyIds }),
  ]);
  const coverUrls = await getCoverImageUrls(organizationId, 'inspection', inspections.map((i) => i.id));
  return {
    inspections: inspections.map((i) => ({ ...serializeInspection(i), coverImageUrl: coverUrls.get(i.id) ?? null })),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getInspection(id, organizationId, actingUser) {
  const inspection = await loadInspectionWithAccess(id, organizationId, actingUser);
  const [inspector, tenant] = await Promise.all([
    inspection.inspectorId ? findUserById(inspection.inspectorId, organizationId) : null,
    inspection.unitId ? findTenantByUnitId(inspection.unitId, organizationId) : null,
  ]);
  return {
    ...serializeInspection(inspection),
    inspectorName: inspector ? `${inspector.firstName} ${inspector.lastName}` : null,
    tenant: tenant ? { id: tenant.id, name: `${tenant.firstName} ${tenant.lastName}`, email: tenant.email, phone: tenant.phone } : null,
  };
}

export async function scheduleInspection(organizationId, body, actingUser, req) {
  const property = await findPropertyById(body.propertyId, organizationId);
  if (!property) throw AppError.badRequest('The specified property does not exist in this organization.');
  await assertPropertyAccess(property, actingUser);

  // What is inspected depends on how the property is organised: a whole
  // property has no buildings or units to pick; a property with buildings is
  // inspected building by building; and so on.
  let unit = null;
  let buildingId = body.buildingId ?? null;
  if (property.structureType === 'whole' && (body.buildingId || body.unitId)) throw AppError.badRequest('This is a whole property — it has no buildings or units to choose.');
  if (property.structureType === 'buildings' && body.unitId) throw AppError.badRequest('Buildings in this property are inspected as a whole — choose a building.');
  if (property.structureType === 'buildings' && !body.buildingId) throw AppError.badRequest('Choose the building to inspect.');
  if (property.structureType === 'buildings_units' && !body.buildingId && !body.unitId) throw AppError.badRequest('Choose a building, or a unit in a building.');
  if (buildingId) {
    const building = await prisma.building.findFirst({ where: { id: buildingId, propertyId: body.propertyId } });
    if (!building) throw AppError.badRequest('The specified building does not belong to this property.');
  }
  if (body.unitId) {
    unit = await findUnitById(body.unitId, organizationId);
    if (!unit || unit.building.propertyId !== body.propertyId) throw AppError.badRequest('The specified unit does not belong to this property.');
    if (buildingId && unit.buildingId !== buildingId) throw AppError.badRequest('That unit is not in the chosen building.');
    buildingId = unit.buildingId;
  }
  if (body.inspectorId) {
    const inspector = await findUserById(body.inspectorId, organizationId);
    if (!inspector) throw AppError.badRequest('The specified inspector does not exist in this organization.');
  }

  const inspection = await createInspection({
    organizationId,
    propertyId: body.propertyId,
    buildingId,
    unitId: body.unitId ?? null,
    inspectorId: body.inspectorId ?? null,
    inspectionDate: body.inspectionDate,
    type: body.type,
    status: 'scheduled',
  });

  await audit({ organizationId, userId: actingUser.id, action: 'inspection.scheduled', entityType: 'inspection', entityId: inspection.id, newValues: { type: inspection.type, propertyId: body.propertyId }, req });

  // Best-effort resident notice: the unit's current tenant (if any) is
  // emailed, and gets an in-app notification too when they have a linked
  // login. Neither failure mode should roll back the inspection itself —
  // scheduling must succeed even if the mail provider is down.
  if (unit) {
    try {
      const tenant = await findTenantByUnitId(unit.id, organizationId);
      if (tenant?.email) {
        const org = await findOrganizationById(organizationId);
        const { subject, html, text } = inspectionScheduledEmail({
          org,
          propertyName: property.name,
          unitLabel: `Unit ${unit.unitNumber}`,
          inspectionType: inspection.type,
          inspectionDate: inspection.inspectionDate,
        });
        await sendMail({ to: tenant.email, subject, html, text });
      }
      if (tenant?.userId) {
        // sendEmail: false — the richer inspectionScheduledEmail above
        // already covers this event; notify()'s default generic email
        // would otherwise double-email the tenant.
        await notify({
          organizationId, userId: tenant.userId, type: 'inspection_scheduled',
          title: 'Inspection scheduled', message: `A ${inspection.type.replace('_', ' ')} inspection is scheduled for Unit ${unit.unitNumber} on ${new Date(inspection.inspectionDate).toLocaleDateString()}.`,
          sendEmail: false,
        });
      }
    } catch (err) {
      logger.error({ err, inspectionId: inspection.id }, 'failed to notify tenant of scheduled inspection');
    }
  }

  return getInspection(inspection.id, organizationId, actingUser);
}

export async function updateInspectionRecord(id, organizationId, body, actingUser, req) {
  const inspection = await loadInspectionWithAccess(id, organizationId, actingUser);
  if (inspection.status === 'completed') throw AppError.conflict('A completed inspection cannot be edited.');

  await updateInspection(id, body);
  await audit({ organizationId, userId: actingUser.id, action: 'inspection.updated', entityType: 'inspection', entityId: id, newValues: body, req });
  return getInspection(id, organizationId, actingUser);
}

export async function completeInspection(id, organizationId, body, actingUser, req) {
  const inspection = await loadInspectionWithAccess(id, organizationId, actingUser);
  if (!['scheduled', 'in_progress'].includes(inspection.status)) {
    throw AppError.conflict(`Only a scheduled or in-progress inspection can be completed (current status: ${inspection.status}).`);
  }

  await setInspectionStatus(id, 'completed', { condition: body.condition ?? inspection.condition, notes: body.notes ?? inspection.notes });
  await audit({ organizationId, userId: actingUser.id, action: 'inspection.completed', entityType: 'inspection', entityId: id, newValues: { status: 'completed' }, req });
  return getInspection(id, organizationId, actingUser);
}

export async function cancelInspection(id, organizationId, actingUser, req) {
  const inspection = await loadInspectionWithAccess(id, organizationId, actingUser);
  if (!['scheduled', 'in_progress'].includes(inspection.status)) {
    throw AppError.conflict(`Cannot cancel an inspection with status "${inspection.status}".`);
  }

  await setInspectionStatus(id, 'cancelled');
  await audit({ organizationId, userId: actingUser.id, action: 'inspection.cancelled', entityType: 'inspection', entityId: id, newValues: { status: 'cancelled' }, req });
  return getInspection(id, organizationId, actingUser);
}
