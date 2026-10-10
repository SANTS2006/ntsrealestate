import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as unitService from '../services/unit.service.js';

export const list = asyncHandler(async (req, res) => {
  const units = await unitService.listUnits(req.params.buildingId, req.user.organizationId, req.user, { status: req.query.status });
  sendSuccess(res, { data: units });
});

export const get = asyncHandler(async (req, res) => {
  const unit = await unitService.getUnit(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: unit });
});

export const create = asyncHandler(async (req, res) => {
  const unit = await unitService.createUnitRecord(req.params.buildingId, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: unit, message: 'Unit created.' });
});

export const update = asyncHandler(async (req, res) => {
  const unit = await unitService.updateUnitRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: unit, message: 'Unit updated.' });
});

export const setStatus = asyncHandler(async (req, res) => {
  const unit = await unitService.setUnitManualStatus(req.params.id, req.user.organizationId, req.body.status, req.user, req);
  sendSuccess(res, { data: unit, message: 'Unit status updated.' });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await unitService.deleteUnitRecord(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result, message: 'Unit deleted.' });
});

export const endRental = asyncHandler(async (req, res) => {
  const unit = await unitService.endUnitRental(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: unit, message: 'Rental ended. It is available again.' });
});
