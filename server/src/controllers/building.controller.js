import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import * as buildingService from '../services/building.service.js';

export const list = asyncHandler(async (req, res) => {
  const buildings = await buildingService.listBuildings(req.params.propertyId, req.user.organizationId, req.user);
  sendSuccess(res, { data: buildings });
});

export const get = asyncHandler(async (req, res) => {
  const building = await buildingService.getBuilding(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: building });
});

export const create = asyncHandler(async (req, res) => {
  const building = await buildingService.createBuildingRecord(req.params.propertyId, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: building, message: 'Building created.' });
});

export const update = asyncHandler(async (req, res) => {
  const building = await buildingService.updateBuildingRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: building, message: 'Building updated.' });
});

export const remove = asyncHandler(async (req, res) => {
  const result = await buildingService.deleteBuildingRecord(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: result, message: 'Building deleted.' });
});
