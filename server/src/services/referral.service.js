import { AppError } from '../utils/AppError.js';
import { buildPaginationMeta } from '../utils/pagination.js';
import {
  createReferral, findReferralById, findReferralsByOrganization, countReferralsByOrganization,
  setReferralApproved, setReferralPaid, findScopedReferrals, countScopedReferrals,
} from '../repositories/referral.repository.js';
import { getRestrictedScope } from './resourceAccess.service.js';
import { findUserByReferralCode } from '../repositories/user.repository.js';
import { audit } from './audit.service.js';
import { notify } from './notification.service.js';

function serializeReferral(referral) {
  return {
    id: referral.id,
    code: referral.code,
    bonusAmount: referral.bonusAmount,
    status: referral.status,
    paidAt: referral.paidAt,
    createdAt: referral.createdAt,
    referrer: referral.referrer ? { id: referral.referrer.id, firstName: referral.referrer.firstName, lastName: referral.referrer.lastName, email: referral.referrer.email } : undefined,
    referred: referral.referred ? { id: referral.referred.id, firstName: referral.referred.firstName, lastName: referral.referred.lastName, email: referral.referred.email } : undefined,
  };
}

// Called from auth.service.js#registerOrganization once the new user
// exists. A missing/invalid/unknown code never blocks registration — this
// is a bonus program, not a gate, so any failure here is logged-and-
// swallowed the same way notify() treats its own failures.
export async function recordReferralIfCodeValid({ organizationId, code, referredUserId }) {
  if (!code) return;
  const referrer = await findUserByReferralCode(code.trim().toUpperCase());
  if (!referrer || referrer.organizationId !== organizationId || referrer.id === referredUserId) return;

  const referral = await createReferral({
    organizationId, referrerId: referrer.id, referredId: referredUserId, code: referrer.referralCode,
  });

  await notify({
    organizationId, userId: referrer.id, type: 'referral_used',
    title: 'Your referral code was used', message: 'Someone just signed up using your referral code — an administrator will review your bonus shortly.',
  });

  return referral;
}

export async function listMyReferrals(organizationId, actingUser, { page, pageSize, skip, take }) {
  const [referrals, total] = await Promise.all([
    findReferralsByOrganization(organizationId, { skip, take, referrerId: actingUser.id }),
    countReferralsByOrganization(organizationId, { referrerId: actingUser.id }),
  ]);
  return { referrals: referrals.map(serializeReferral), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function listScopedReferrals(organizationId, actingUser, { page, pageSize, skip, take }) {
  const scope = await getRestrictedScope(actingUser, organizationId);
  const propertyIds = scope.propertyIds ?? [];
  const [referrals, total] = await Promise.all([
    findScopedReferrals(organizationId, { skip, take, propertyIds, userId: actingUser.id }),
    countScopedReferrals(organizationId, { propertyIds, userId: actingUser.id }),
  ]);
  return { referrals: referrals.map(serializeReferral), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function listAllReferrals(organizationId, { page, pageSize, skip, take, status }) {
  const [referrals, total] = await Promise.all([
    findReferralsByOrganization(organizationId, { skip, take, status }),
    countReferralsByOrganization(organizationId, { status }),
  ]);
  return { referrals: referrals.map(serializeReferral), meta: buildPaginationMeta({ page, pageSize, total }) };
}

export async function approveReferral(id, organizationId, bonusAmount, actingUser, req) {
  const referral = await findReferralById(id, organizationId);
  if (!referral) throw AppError.notFound('Referral not found.');
  if (referral.status === 'paid') throw AppError.conflict('This referral has already been paid — its bonus amount can no longer be changed.');

  const updated = await setReferralApproved(id, bonusAmount);
  await audit({ organizationId, userId: actingUser.id, action: 'referral.approved', entityType: 'referral', entityId: id, newValues: { bonusAmount, status: 'approved' }, req });
  await notify({
    organizationId, userId: referral.referrerId, type: 'referral_bonus_approved',
    title: 'Referral bonus approved', message: 'Your referral bonus has been set — an administrator will pay it out shortly.',
  });
  return serializeReferral(updated);
}

export async function markReferralPaid(id, organizationId, actingUser, req) {
  const referral = await findReferralById(id, organizationId);
  if (!referral) throw AppError.notFound('Referral not found.');
  if (referral.status !== 'approved') throw AppError.conflict(`Only an approved referral can be marked paid (current status: ${referral.status}).`);

  const updated = await setReferralPaid(id);
  await audit({ organizationId, userId: actingUser.id, action: 'referral.paid', entityType: 'referral', entityId: id, newValues: { status: 'paid' }, req });
  await notify({
    organizationId, userId: referral.referrerId, type: 'referral_bonus_paid',
    title: 'Referral bonus paid', message: 'Your referral bonus has been paid out. Thanks for spreading the word!',
  });
  return serializeReferral(updated);
}
