import { deleteDocumentsFor } from './recordCleanup.service.js';
import { prisma } from '../config/database.js';
import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createVendor, findVendorById, findVendorsByOrganization, countVendorsByOrganization,
  updateVendor, setVendorStatus,
} from '../repositories/vendor.repository.js';
import { getCoverImageUrls } from './document.service.js';
import { audit } from './audit.service.js';

function serializeVendor(vendor) {
  return {
    id: vendor.id,
    name: vendor.name,
    contactPerson: vendor.contactPerson,
    email: vendor.email,
    phone: vendor.phone,
    address: vendor.address,
    serviceType: vendor.serviceType,
    status: vendor.status,
  };
}

// Vendors are an organization-wide directory, not tied to one property, so
// (unlike properties/leases/expenses) there's no assignment/ownership
// scoping here — every role holding `vendors:read` sees the full list.
export async function listVendors(organizationId, { page, pageSize, skip, take, search, status, serviceType }) {
  const [vendors, total] = await Promise.all([
    findVendorsByOrganization(organizationId, { skip, take, search, status, serviceType }),
    countVendorsByOrganization(organizationId, { search, status, serviceType }),
  ]);
  const coverUrls = await getCoverImageUrls(organizationId, 'vendor', vendors.map((v) => v.id));
  return {
    vendors: vendors.map((v) => ({ ...serializeVendor(v), coverImageUrl: coverUrls.get(v.id) ?? null })),
    meta: buildPaginationMeta({ page, pageSize, total }),
  };
}

export async function getVendor(id, organizationId) {
  const vendor = await findVendorById(id, organizationId);
  if (!vendor) throw AppError.notFound('Vendor not found.');
  return serializeVendor(vendor);
}

export async function createVendorRecord(organizationId, body, actingUser, req) {
  const vendor = await createVendor({
    organizationId,
    name: body.name,
    contactPerson: body.contactPerson ?? null,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
    serviceType: body.serviceType ?? null,
  });

  await audit({ organizationId, userId: actingUser.id, action: 'vendor.created', entityType: 'vendor', entityId: vendor.id, newValues: { name: vendor.name }, req });
  return serializeVendor(vendor);
}

export async function updateVendorRecord(id, organizationId, body, actingUser, req) {
  const existing = await findVendorById(id, organizationId);
  if (!existing) throw AppError.notFound('Vendor not found.');

  await updateVendor(id, organizationId, body);
  await audit({ organizationId, userId: actingUser.id, action: 'vendor.updated', entityType: 'vendor', entityId: id, newValues: body, req });
  return getVendor(id, organizationId);
}

export async function setVendorActiveStatus(id, organizationId, status, actingUser, req) {
  const existing = await findVendorById(id, organizationId);
  if (!existing) throw AppError.notFound('Vendor not found.');

  await setVendorStatus(id, organizationId, status);
  await audit({ organizationId, userId: actingUser.id, action: 'vendor.status_changed', entityType: 'vendor', entityId: id, oldValues: { status: existing.status }, newValues: { status }, req });
  return getVendor(id, organizationId);
}

// Past expenses and work orders that used this vendor keep their amounts and
// history; they simply no longer point at a vendor. The vendor's own files
// (logo/photos) are removed with it.
export async function deleteVendorRecord(id, organizationId, actingUser, req) {
  const existing = await findVendorById(id, organizationId);
  if (!existing) throw AppError.notFound('Vendor not found.');

  await deleteDocumentsFor(organizationId, 'vendor', id);
  await prisma.vendor.delete({ where: { id } });
  await audit({ organizationId, userId: actingUser.id, action: 'vendor.deleted', entityType: 'vendor', entityId: null, oldValues: { name: existing.name }, req });
  return { deleted: true };
}
