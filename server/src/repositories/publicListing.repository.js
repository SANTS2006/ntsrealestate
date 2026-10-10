import { prisma } from '../config/database.js';

// Every query here is scoped to (a) the primary organization (the caller
// always passes PRIMARY_ORGANIZATION_ID — see publicListing.service.js) and
// (b) units that are actually rentable right now: the unit itself
// `available`, and its property `active` (never archived/under
// construction). No authentication exists on this path, so these two
// filters are the entire access boundary — nothing here may ever leak a
// unit that isn't meant to be publicly listed.
const PRICE_FIELD = { rent: 'monthlyRent', buy: 'salePrice', lease: 'leasePrice' };
const OFFER_FLAG = { rent: 'offerRent', buy: 'offerSale', lease: 'offerLease' };

function buildAvailableUnitWhere(organizationId, { city, unitType, maxPrice, minPrice, minBedrooms, minBathrooms, kind, offer, furnished, amenities, q }) {
  const and = [];
  const priceField = PRICE_FIELD[offer] ?? 'monthlyRent';
  // Rent / buy / lease: only what is actually offered that way.
  if (offer) and.push({ [OFFER_FLAG[offer]]: true });
  else and.push({ OR: [{ offerRent: true }, { offerSale: true }, { offerLease: true }] });
  // "Type" matches the unit's own type, or the property's category when the unit has none.
  if (unitType) and.push({ OR: [{ unitType }, { unitType: null, building: { property: { propertyType: unitType } } }] });
  // What is being rented: the whole property, a whole building, or one unit/room.
  if (kind === 'whole') and.push({ isWhole: true, building: { isImplicit: true } });
  if (kind === 'building') and.push({ isWhole: true, building: { isImplicit: false } });
  if (kind === 'unit') and.push({ isWhole: false });
  if (furnished) and.push({ furnished: true });
  // Every chosen facility must be offered by the unit itself or its property.
  for (const a of amenities ?? []) {
    and.push({ OR: [{ amenities: { has: a } }, { building: { property: { amenities: { has: a } } } }] });
  }
  if (q) {
    const contains = { contains: q, mode: 'insensitive' };
    and.push({
      OR: [
        { unitNumber: contains },
        { building: { name: contains } },
        { building: { property: { name: contains } } },
        { building: { property: { address: contains } } },
        { building: { property: { city: contains } } },
      ],
    });
  }
  return {
    status: 'available',
    building: {
      property: {
        organizationId,
        status: 'active',
        ...(city ? { city } : {}),
      },
    },
    ...((maxPrice || minPrice) ? { [priceField]: { ...(maxPrice ? { lte: maxPrice } : {}), ...(minPrice ? { gte: minPrice } : {}) } } : {}),
    ...(minBedrooms ? { bedrooms: { gte: minBedrooms } } : {}),
    ...(minBathrooms ? { bathrooms: { gte: minBathrooms } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

const UNIT_INCLUDE = {
  building: { include: { property: true } },
};

function filtersOf(f) {
  return { city: f.city, unitType: f.unitType, maxPrice: f.maxPrice, minPrice: f.minPrice, minBedrooms: f.minBedrooms, minBathrooms: f.minBathrooms, kind: f.kind, offer: f.offer, furnished: f.furnished, amenities: f.amenities, q: f.q };
}

function sortToOrderBy(sort, offer) {
  const field = PRICE_FIELD[offer] ?? 'monthlyRent';
  if (sort === 'price-asc') return { [field]: 'asc' };
  if (sort === 'price-desc') return { [field]: 'desc' };
  return { unitNumber: 'asc' }; // 'newest' - Unit has no createdAt column, so this is the stable default
}

export function findAvailableUnitsPublic(organizationId, { skip, take, sort, ...filters }) {
  return prisma.unit.findMany({
    where: buildAvailableUnitWhere(organizationId, filtersOf(filters)),
    include: UNIT_INCLUDE,
    orderBy: sortToOrderBy(sort, filters.offer),
    skip,
    take,
  });
}

export function countAvailableUnitsPublic(organizationId, filters) {
  return prisma.unit.count({ where: buildAvailableUnitWhere(organizationId, filtersOf(filters)) });
}

// A single listing's detail page — same availability/organization boundary
// as the list query (a direct-linked id for a unit that just got rented out
// or delisted correctly 404s rather than ever rendering).
export function findAvailableUnitByIdPublic(id, organizationId) {
  return prisma.unit.findFirst({
    where: { id, ...buildAvailableUnitWhere(organizationId, {}) },
    include: UNIT_INCLUDE,
  });
}

// Filter option lists for the browse page — only values that currently have
// at least one available listing, so the UI never offers a filter that
// would return zero results.
export async function findDistinctCitiesPublic(organizationId) {
  const rows = await prisma.property.findMany({
    where: { organizationId, status: 'active', city: { not: null }, buildings: { some: { units: { some: { status: 'available' } } } } },
    select: { city: true },
    distinct: ['city'],
    orderBy: { city: 'asc' },
  });
  return rows.map((r) => r.city).filter(Boolean);
}

// Everything the filter panel offers, taken from what is actually available
// right now: types, kinds of listing, facilities and the price range.
export async function findFilterFacetsPublic(organizationId, offer) {
  const units = await prisma.unit.findMany({
    where: buildAvailableUnitWhere(organizationId, { offer }),
    select: {
      unitType: true, monthlyRent: true, salePrice: true, leasePrice: true, offerRent: true, offerSale: true, offerLease: true, amenities: true, isWhole: true, furnished: true, bedrooms: true,
      building: { select: { isImplicit: true, property: { select: { propertyType: true, amenities: true } } } },
    },
    take: 2000,
  });
  const types = new Set();
  const amenities = new Set();
  const kinds = { whole: 0, building: 0, unit: 0 };
  const offers = { rent: 0, buy: 0, lease: 0 };
  let min = null; let max = null; let maxBeds = 0; let furnishedCount = 0;
  for (const u of units) {
    const type = u.unitType || u.building.property.propertyType;
    if (type) types.add(type);
    for (const a of [...(u.amenities ?? []), ...(u.building.property.amenities ?? [])]) amenities.add(a);
    if (u.isWhole && u.building.isImplicit) kinds.whole += 1; else if (u.isWhole) kinds.building += 1; else kinds.unit += 1;
    if (u.offerRent) offers.rent += 1;
    if (u.offerSale) offers.buy += 1;
    if (u.offerLease) offers.lease += 1;
    const rent = Number(offer === 'buy' ? u.salePrice : offer === 'lease' ? u.leasePrice : u.monthlyRent);
    if (min === null || rent < min) min = rent;
    if (max === null || rent > max) max = rent;
    if ((u.bedrooms ?? 0) > maxBeds) maxBeds = u.bedrooms;
    if (u.furnished) furnishedCount += 1;
  }
  return {
    unitTypes: [...types].sort(),
    amenities: [...amenities].sort(),
    kinds,
    offers,
    priceRange: { min, max },
    maxBedrooms: maxBeds,
    furnishedCount,
  };
}
