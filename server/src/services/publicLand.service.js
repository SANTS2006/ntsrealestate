import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { findLatestImageDocumentsByEntityIds, findDocumentsByEntity } from '../repositories/document.repository.js';
import { generateSignedAccessUrl } from '../integrations/cloudinary/uploadService.js';

const TTL = 60 * 60;
const toUrl = (doc) => generateSignedAccessUrl({ publicId: doc.cloudinaryPublicId, resourceType: doc.cloudinaryResourceType }, TTL).url;
const num = (v) => (v === null || v === undefined ? null : Number(v));
const roundCoord = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);

// What the public website may know about a land: the area (never the exact
// address), approximate map position, price and specifications. Only lands
// that are still available are shown.
function serialize(land) {
  return {
    id: land.id,
    title: land.title,
    description: land.description ?? '',
    landType: land.landType,
    area: num(land.area),
    areaUnit: land.areaUnit,
    price: num(land.price),
    city: land.city,
    region: land.region,
    country: land.country,
    lat: roundCoord(land.latitude),
    lng: roundCoord(land.longitude),
    titleDocument: land.titleDocument,
    features: land.features ?? [],
  };
}

function buildWhere(organizationId, { q, type, city, minPrice, maxPrice, minArea }) {
  return {
    organizationId,
    status: 'available',
    ...(type ? { landType: type } : {}),
    ...(city ? { city } : {}),
    ...((minPrice || maxPrice) ? { price: { ...(minPrice ? { gte: minPrice } : {}), ...(maxPrice ? { lte: maxPrice } : {}) } } : {}),
    ...(minArea ? { area: { gte: minArea } } : {}),
    ...(q ? { OR: [{ title: { contains: q, mode: 'insensitive' } }, { city: { contains: q, mode: 'insensitive' } }, { region: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] } : {}),
  };
}

export async function listPublicLands(organizationId, { page, pageSize, skip, take, sort, ...filters }) {
  const where = buildWhere(organizationId, filters);
  const orderBy = sort === 'price-asc' ? { price: 'asc' } : sort === 'price-desc' ? { price: 'desc' } : sort === 'area-desc' ? { area: 'desc' } : { createdAt: 'desc' };
  const [lands, total] = await Promise.all([
    prisma.land.findMany({ where, orderBy, skip, take }),
    prisma.land.count({ where }),
  ]);
  const covers = await findLatestImageDocumentsByEntityIds(organizationId, 'land', lands.map((l) => l.id));
  const coverMap = new Map();
  for (const d of covers) if (!coverMap.has(d.entityId)) coverMap.set(d.entityId, d);
  return {
    lands: lands.map((l) => ({ ...serialize(l), coverImage: coverMap.has(l.id) ? toUrl(coverMap.get(l.id)) : null })),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getPublicLand(id, organizationId) {
  const land = await prisma.land.findFirst({ where: { id, organizationId, status: 'available' } });
  if (!land) throw AppError.notFound('This land is no longer available.');
  const docs = await findDocumentsByEntity(organizationId, 'land', id, { skip: 0, take: 60 });
  return {
    ...serialize(land),
    images: docs.filter((d) => d.mimeType.startsWith('image/')).map(toUrl),
    videos: docs.filter((d) => d.mimeType.startsWith('video/')).map(toUrl),
  };
}

export async function getPublicLandOptions(organizationId) {
  const lands = await prisma.land.findMany({ where: { organizationId, status: 'available' }, select: { landType: true, city: true, price: true, area: true, areaUnit: true } });
  const prices = lands.map((l) => Number(l.price));
  return {
    types: [...new Set(lands.map((l) => l.landType))].sort(),
    cities: [...new Set(lands.map((l) => l.city).filter(Boolean))].sort(),
    priceRange: { min: prices.length ? Math.min(...prices) : null, max: prices.length ? Math.max(...prices) : null },
    total: lands.length,
  };
}
