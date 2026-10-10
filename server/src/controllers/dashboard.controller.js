import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { getDashboard } from '../services/dashboard.service.js';

export const get = asyncHandler(async (req, res) => {
  const dashboard = await getDashboard(req.user.organizationId, req.user);
  sendSuccess(res, { data: dashboard });
});
