import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as referralService from '../services/referral.service.js';

// GET /referrals — administrator/accountant see every referral in the
// organization; anyone else (a tenant with referrals:read) sees only the
// referrals they themselves made. Same "query-mode branch on role, never
// row duplication" pattern as notifications/tenant-messages.
export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const canViewAll = req.user.roles.some((r) => ['administrator', 'accountant', 'auditor'].includes(r));
  const sees = (...roles) => req.user.roles.some((r) => roles.includes(r));
  const result = canViewAll
    ? await referralService.listAllReferrals(req.user.organizationId, { page, pageSize, skip, take, status: req.query.status })
    : sees('owner', 'agent')
      ? await referralService.listScopedReferrals(req.user.organizationId, req.user, { page, pageSize, skip, take })
      : await referralService.listMyReferrals(req.user.organizationId, req.user, { page, pageSize, skip, take });
  sendSuccess(res, { data: result.referrals, meta: result.meta });
});

export const approve = asyncHandler(async (req, res) => {
  const referral = await referralService.approveReferral(req.params.id, req.user.organizationId, req.body.bonusAmount, req.user, req);
  sendSuccess(res, { data: referral, message: 'Referral bonus approved.' });
});

export const markPaid = asyncHandler(async (req, res) => {
  const referral = await referralService.markReferralPaid(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: referral, message: 'Referral bonus marked as paid.' });
});
