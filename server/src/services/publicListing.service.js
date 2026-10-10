import { AppError } from '../utils/AppError.js';
import { unitTitle } from '../utils/unitLabel.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import { env } from '../config/env.js';
import {
  findAvailableUnitsPublic, countAvailableUnitsPublic, findAvailableUnitByIdPublic,
  findDistinctCitiesPublic, findFilterFacetsPublic,
} from '../repositories/publicListing.repository.js';
import { findLatestImageDocumentsByEntityIds, findDocumentsByEntity } from '../repositories/document.repository.js';
import { findAgentAssignmentsForProperty, findAllAgents } from '../repositories/propertyAssignment.repository.js';
import { generateSignedAccessUrl } from '../integrations/cloudinary/uploadService.js';
import { countPropertiesByOrganization } from '../repositories/property.repository.js';
import { countTenantsByOrganization } from '../repositories/tenant.repository.js';

// Public images are served through the exact same signed-URL mechanism as
// the authenticated app (see document.service.js) — nothing about Cloudinary
// storage changes for "public" listing photos, only who's allowed to ask for
// a signed URL to view them (see publicListing.repository.js's availability/
// organization filter, which is the real access boundary). A longer TTL
// than the authenticated app's 5 minutes is deliberate: an anonymous visitor
// may sit on a listing page far longer than a logged-in session action.
const LISTING_IMAGE_TTL_SECONDS = 60 * 60;

function toSignedUrl(doc) {
  return generateSignedAccessUrl({ publicId: doc.cloudinaryPublicId, resourceType: doc.cloudinaryResourceType }, LISTING_IMAGE_TTL_SECONDS).url;
}

const listingTitle = unitTitle;

function serializeAgent(assignment) {
  const user = assignment.user;
  return { name: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone };
}

const roundCoord = (v) => (v === null || v === undefined ? null : Math.round(Number(v) * 100) / 100);

// The price shown for a listing, and what it is per.
function priceFor(unit, offer) {
  const n = (v) => (v === null || v === undefined ? null : Number(v));
  if (offer === 'buy') return { price: n(unit.salePrice), priceUnit: 'total' };
  if (offer === 'lease') return { price: n(unit.leasePrice), priceUnit: 'year' };
  if (offer === 'rent' || unit.offerRent) return { price: n(unit.monthlyRent), priceUnit: 'month' };
  if (unit.offerSale) return { price: n(unit.salePrice), priceUnit: 'total' };
  return { price: n(unit.leasePrice), priceUnit: 'year' };
}

function baseListingFields(unit, offer) {
  const property = unit.building.property;
  const { price, priceUnit } = priceFor(unit, offer);
  return {
    id: unit.id,
    title: listingTitle(unit),
    type: unit.unitType || property.propertyType,
    price,
    priceUnit,
    offers: {
      rent: unit.offerRent ? Number(unit.monthlyRent) : null,
      buy: unit.offerSale && unit.salePrice !== null ? Number(unit.salePrice) : null,
      lease: unit.offerLease && unit.leasePrice !== null ? { price: Number(unit.leasePrice), termMonths: unit.leaseTermMonths ?? 12 } : null,
    },
    bedrooms: unit.bedrooms ?? 0,
    bathrooms: unit.bathrooms ?? 0,
    area: unit.area,
    description: unit.description || unit.building.description || property.description || '',
    structure: property.structureType,
    propertyName: property.name,
    buildingName: unit.building.isImplicit ? null : unit.building.name,
    unitNumber: unit.isWhole ? null : unit.unitNumber,
    isWhole: unit.isWhole,
    floor: unit.floor,
    deposit: unit.securityDeposit,
    furnished: unit.furnished,
    amenities: [...new Set([...(unit.amenities ?? []), ...(property.amenities ?? [])])],
    // The street address is never published — only the area.
    city: property.city,
    region: property.region,
    country: property.country,
    // null when the property has never had coordinates set — the client
    // renders no map/pin for a listing missing these rather than guessing.
    lat: roundCoord(property.latitude),
    lng: roundCoord(property.longitude),
    yearBuilt: property.yearBuilt,
  };
}

export async function listPublicListings(organizationId, { page, pageSize, skip, take, sort, ...filters }) {
  const [units, total] = await Promise.all([
    findAvailableUnitsPublic(organizationId, { skip, take, sort, ...filters }),
    countAvailableUnitsPublic(organizationId, filters),
  ]);

  // Cover image, unit-level first, falling back to the property's own cover
  // photo for units that have no interior shots uploaded yet.
  const unitIds = units.map((u) => u.id);
  const propertyIds = [...new Set(units.map((u) => u.building.property.id))];
  const buildingIds = [...new Set(units.filter((u) => !u.building.isImplicit).map((u) => u.buildingId))];
  const [unitCovers, propertyCovers, buildingCovers] = await Promise.all([
    findLatestImageDocumentsByEntityIds(organizationId, 'unit', unitIds),
    findLatestImageDocumentsByEntityIds(organizationId, 'property', propertyIds),
    findLatestImageDocumentsByEntityIds(organizationId, 'building', buildingIds),
  ]);
  const buildingCoverMap = new Map();
  for (const doc of buildingCovers) if (!buildingCoverMap.has(doc.entityId)) buildingCoverMap.set(doc.entityId, doc);
  const unitCoverMap = new Map();
  for (const doc of unitCovers) if (!unitCoverMap.has(doc.entityId)) unitCoverMap.set(doc.entityId, doc);
  const propertyCoverMap = new Map();
  for (const doc of propertyCovers) if (!propertyCoverMap.has(doc.entityId)) propertyCoverMap.set(doc.entityId, doc);

  const listings = units.map((unit) => {
    const cover = unitCoverMap.get(unit.id) ?? buildingCoverMap.get(unit.buildingId) ?? propertyCoverMap.get(unit.building.property.id);
    return {
      ...baseListingFields(unit, filters.offer),
      coverImage: cover ? toSignedUrl(cover) : null,
    };
  });

  return { listings, meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function getPublicListing(id, organizationId) {
  const unit = await findAvailableUnitByIdPublic(id, organizationId);
  if (!unit) throw AppError.notFound('This listing is no longer available.');

  const property = unit.building.property;
  const [unitDocs, buildingDocs, propertyDocs, assignments] = await Promise.all([
    findDocumentsByEntity(organizationId, 'unit', unit.id, { skip: 0, take: 50 }),
    unit.building.isImplicit ? [] : findDocumentsByEntity(organizationId, 'building', unit.buildingId, { skip: 0, take: 50 }),
    findDocumentsByEntity(organizationId, 'property', property.id, { skip: 0, take: 50 }),
    findAgentAssignmentsForProperty(property.id, organizationId),
  ]);

  const images = [...unitDocs, ...buildingDocs, ...propertyDocs]
    .filter((d) => d.mimeType.startsWith('image/'))
    .map(toSignedUrl);

  return {
    ...baseListingFields(unit),
    images,
    agent: assignments[0] ? serializeAgent(assignments[0]) : null,
  };
}

export async function getPublicFilterOptions(organizationId, offer) {
  const [cities, facets] = await Promise.all([
    findDistinctCitiesPublic(organizationId),
    findFilterFacetsPublic(organizationId, offer),
  ]);
  return { cities, ...facets };
}

export async function getPublicAgents(organizationId) {
  const agents = await findAllAgents(organizationId);
  const photoMap = await findLatestImageDocumentsByEntityIds(organizationId, 'user', agents.map((a) => a.id));
  const photoByUserId = new Map();
  for (const doc of photoMap) if (!photoByUserId.has(doc.entityId)) photoByUserId.set(doc.entityId, doc);

  return agents.map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`,
    email: a.email,
    phone: a.phone,
    photo: photoByUserId.has(a.id) ? toSignedUrl(photoByUserId.get(a.id)) : null,
  }));
}

// Resolves the listing agent(s) for an inquiry/contact email — shared by
// publicInquiry.service.js so it never has to know how a unit maps to a
// property maps to its assigned agents.
export async function getListingAgentAssignments(unitId, organizationId) {
  const unit = await findAvailableUnitByIdPublic(unitId, organizationId);
  if (!unit) return { unit: null, assignments: [] };
  const assignments = await findAgentAssignmentsForProperty(unit.building.property.id, organizationId);
  return { unit, assignments };
}


// Real, aggregate-only numbers for the homepage stats strip — deliberately
// nothing per-record (no names, no addresses here), just counts. Replaces
// what would otherwise be hardcoded marketing copy.
export async function getPublicStats(organizationId) {
  const [totalProperties, availableListings, cities, agents, totalTenants] = await Promise.all([
    countPropertiesByOrganization(organizationId, { status: 'active' }),
    countAvailableUnitsPublic(organizationId, {}),
    findDistinctCitiesPublic(organizationId),
    findAllAgents(organizationId),
    countTenantsByOrganization(organizationId, { status: 'active' }),
  ]);
  return {
    totalProperties,
    availableListings,
    neighborhoods: cities.length,
    agents: agents.length,
    tenants: totalTenants,
  };
}
