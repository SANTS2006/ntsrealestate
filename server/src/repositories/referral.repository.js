import { prisma } from '../config/database.js';

const REFERRER_SELECT = { id: true, firstName: true, lastName: true, email: true };

export function createReferral(data) {
  return prisma.referral.create({ data });
}

export function findReferralById(id, organizationId) {
  return prisma.referral.findFirst({
    where: { id, organizationId },
    include: { referrer: { select: REFERRER_SELECT }, referred: { select: REFERRER_SELECT } },
  });
}

function buildReferralListWhere(organizationId, { status, referrerId }) {
  return {
    organizationId,
    ...(status ? { status } : {}),
    ...(referrerId ? { referrerId } : {}),
  };
}

export function findReferralsByOrganization(organizationId, { skip, take, status, referrerId }) {
  return prisma.referral.findMany({
    where: buildReferralListWhere(organizationId, { status, referrerId }),
    include: { referrer: { select: REFERRER_SELECT }, referred: { select: REFERRER_SELECT } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countReferralsByOrganization(organizationId, { status, referrerId }) {
  return prisma.referral.count({ where: buildReferralListWhere(organizationId, { status, referrerId }) });
}

export function setReferralApproved(id, bonusAmount) {
  return prisma.referral.update({
    where: { id },
    data: { status: 'approved', bonusAmount },
    include: { referrer: { select: REFERRER_SELECT }, referred: { select: REFERRER_SELECT } },
  });
}

export function setReferralPaid(id) {
  return prisma.referral.update({
    where: { id },
    data: { status: 'paid', paidAt: new Date() },
    include: { referrer: { select: REFERRER_SELECT }, referred: { select: REFERRER_SELECT } },
  });
}

// Referrals made by (or for) tenants who rent within the given properties —
// what an owner or agent sees of the referral program for their portfolio —
// plus any the caller made themselves.
function buildScopedReferralWhere(organizationId, { propertyIds, userId }) {
  const inScope = { tenant: { rentals: { some: { propertyId: { in: propertyIds }, status: 'active' } } } };
  return {
    organizationId,
    OR: [{ referrerId: userId }, { referrer: inScope }, { referred: inScope }],
  };
}

export function findScopedReferrals(organizationId, { skip, take, propertyIds, userId }) {
  return prisma.referral.findMany({
    where: buildScopedReferralWhere(organizationId, { propertyIds, userId }),
    include: { referrer: { select: REFERRER_SELECT }, referred: { select: REFERRER_SELECT } },
    orderBy: { createdAt: 'desc' },
    skip,
    take,
  });
}

export function countScopedReferrals(organizationId, { propertyIds, userId }) {
  return prisma.referral.count({ where: buildScopedReferralWhere(organizationId, { propertyIds, userId }) });
}
