import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as rentalService from '../services/rental.service.js';

export const request = asyncHandler(async (req, res) => {
  const result = await rentalService.requestRental(req.user, req.body, req);
  sendSuccess(res, {
    statusCode: result.alreadyHeld ? 200 : 201,
    data: result,
    message: result.alreadyHeld ? 'You already have this registered.' : 'Registered. The owner and agents have been notified.',
  });
});

export const mine = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await rentalService.listMyRentals(req.user) });
});

export const scopeOptions = asyncHandler(async (req, res) => {
  sendSuccess(res, { data: await rentalService.getTenantScopeOptions(req.user) });
});
