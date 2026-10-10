import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/AppError.js';
import { sendSuccess } from '../../utils/apiResponse.js';
import { getNetwork } from '../../services/network.service.js';

export const networkRouter = Router();

// The whole-organization picture is for the administrator only: owners see
// just their own people through the Agents / Tenants pages.
networkRouter.get('/', authenticate, asyncHandler(async (req, res) => {
  if (!req.user.roles.includes('administrator')) throw AppError.forbidden('Only an administrator can view the organization network.');
  sendSuccess(res, { data: await getNetwork(req.user.organizationId) });
}));
