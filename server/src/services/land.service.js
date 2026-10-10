import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { getCoverImageUrls } from './document.service.js';
import { deleteDocumentsFor } from './recordCleanup.service.js';
import { getSalesScope } from './salesScope.service.js';
import { NO_MATCH_ID } from './resourceAccess.service.js';
import { audit } from './audit.service.js';

const num = (v) => (v === null || v === undefined ? null : Number(v));

function serializeLand(land) {
  return {
    id: land.id,
    ownerId: land.ownerId,
    ownerName: land.owner?.name ?? null,
    title: land.title,
    description: land.description,
    landType: land.landType,
    area: num(land.area),
    areaUnit: land.areaUnit,
    price: num(land.price),
    address: land.address,
    city: land.city,
    region: land.region,
    country: land.country,
    latitude: num(land.latitude),
    longitude: num(land.longitude),
    titleDocument: land.titleDocument,
    features: land.features ?? [],
    status: land.status,
    createdAt: land.createdAt,
    updatedAt: land.updatedAt,
  };
}

// Lands an owner/agent is related to are the ones tagged to the owner (or the
// owners they work for). Organization-wide roles see every land, including
// ones the company holds itself (no owner).
async function scopeWhere(actingUser, organizationId) {
  const scope = await getSalesScope(actingUser, organizationId);
  if (scope.orgWide) return {};
  if (scope.tenantId) return { id: NO_MATCH_ID };
  return { ownerId: { in: scope.ownerIds?.length ? scope.ownerIds : [NO_MATCH_ID] } };
}

async function loadLand(id, organizationId, actingUser) {
  const where = await scopeWhere(actingUser, organizationId);
  const land = await prisma.land.findFirst({ where: { id, organizationId, ...where }, include: { owner: { select: { name: true } } } });
  if (!land) throw AppError.notFound('Land not found.');
  return land;
}

export async function listLands(organizationId, actingUser, { page, pageSize, skip, take, search, status }) {
  const where = {
    organizationId,
    ...(await scopeWhere(actingUser, organizationId)),
    ...(status ? { status } : {}),
    ...(search ? { OR: [{ title: { contains: search, mode: 'insensitive' } }, { city: { contains: search, mode: 'insensitive' } }, { region: { contains: search, mode: 'insensitive' } }, { address: { contains: search, mode: 'insensitive' } }] } : {}),
  };
  const [lands, total] = await Promise.all([
    prisma.land.findMany({ where, include: { owner: { select: { name: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.land.count({ where }),
  ]);
  const covers = await getCoverImageUrls(organizationId, 'land', lands.map((l) => l.id));
  return { lands: lands.map((l) => ({ ...serializeLand(l), coverImageUrl: covers.get(l.id) ?? null })), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getLand(id, organizationId, actingUser) {
  const land = await loadLand(id, organizationId, actingUser);
  const covers = await getCoverImageUrls(organizationId, 'land', [id]);
  return { ...serializeLand(land), coverImageUrl: covers.get(id) ?? null };
}

async function assertOwnerInOrg(ownerId, organizationId) {
  if (!ownerId) return;
  const owner = await prisma.owner.findFirst({ where: { id: ownerId, organizationId } });
  if (!owner) throw AppError.badRequest('That owner does not exist in this organization.');
}

export async function createLandRecord(organizationId, body, actingUser, req) {
  await assertOwnerInOrg(body.ownerId, organizationId);
  const land = await prisma.land.create({
    data: {
      organizationId, ownerId: body.ownerId ?? null, title: body.title, description: body.description ?? null,
      landType: body.landType ?? 'residential', area: body.area, areaUnit: body.areaUnit ?? 'acres', price: body.price,
      address: body.address ?? null, city: body.city ?? null, region: body.region ?? null, country: body.country ?? null,
      latitude: body.latitude ?? null, longitude: body.longitude ?? null, titleDocument: body.titleDocument ?? null,
      features: body.features ?? [], status: 'available',
    },
    include: { owner: { select: { name: true } } },
  });
  await audit({ organizationId, userId: actingUser.id, action: 'land.created', entityType: 'land', entityId: land.id, newValues: { title: land.title }, req });
  return serializeLand(land);
}

export async function updateLandRecord(id, organizationId, body, actingUser, req) {
  await loadLand(id, organizationId, actingUser);
  if (body.ownerId !== undefined) await assertOwnerInOrg(body.ownerId, organizationId);
  const data = {};
  for (const k of ['ownerId', 'title', 'description', 'landType', 'area', 'areaUnit', 'price', 'address', 'city', 'region', 'country', 'latitude', 'longitude', 'titleDocument', 'features', 'status']) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  const land = await prisma.land.update({ where: { id }, data, include: { owner: { select: { name: true } } } });
  await audit({ organizationId, userId: actingUser.id, action: 'land.updated', entityType: 'land', entityId: id, newValues: body, req });
  return serializeLand(land);
}

export async function deleteLandRecord(id, organizationId, actingUser, req) {
  const land = await loadLand(id, organizationId, actingUser);
  const live = await prisma.deal.count({ where: { landId: id, status: { in: ['pending', 'approved'] } } });
  if (live > 0) throw AppError.conflict('This land has a purchase in progress and cannot be deleted. Cancel or complete it first.');
  await deleteDocumentsFor(organizationId, 'land', id);
  await prisma.land.delete({ where: { id } });
  await audit({ organizationId, userId: actingUser.id, action: 'land.deleted', entityType: 'land', entityId: null, oldValues: { title: land.title }, req });
  return { deleted: true };
}
