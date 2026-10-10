import { prisma } from '../config/database.js';

export function createVendor(data) {
  return prisma.vendor.create({ data });
}

export function findVendorById(id, organizationId) {
  return prisma.vendor.findFirst({ where: { id, organizationId } });
}

function buildVendorListWhere(organizationId, { search, status, serviceType }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(serviceType ? { serviceType } : {}),
    ...(search
      ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { contactPerson: { contains: search, mode: 'insensitive' } }] }
      : {}),
  };
}

export function findVendorsByOrganization(organizationId, { skip, take, search, status, serviceType }) {
  return prisma.vendor.findMany({ where: buildVendorListWhere(organizationId, { search, status, serviceType }), orderBy: { name: 'asc' }, skip, take });
}

export function countVendorsByOrganization(organizationId, { search, status, serviceType }) {
  return prisma.vendor.count({ where: buildVendorListWhere(organizationId, { search, status, serviceType }) });
}

const UPDATABLE_VENDOR_FIELDS = ['name', 'contactPerson', 'email', 'phone', 'address', 'serviceType'];

export function updateVendor(id, organizationId, data) {
  const update = {};
  for (const field of UPDATABLE_VENDOR_FIELDS) {
    if (data[field] !== undefined) update[field] = data[field];
  }
  return prisma.vendor.updateMany({ where: { id, organizationId }, data: update });
}

export function setVendorStatus(id, organizationId, status) {
  return prisma.vendor.updateMany({ where: { id, organizationId }, data: { status } });
}
