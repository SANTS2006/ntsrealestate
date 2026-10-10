import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import * as inspectionService from '../services/inspection.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await inspectionService.listInspections(req.user.organizationId, req.user, {
    page, pageSize, skip, take, status: req.query.status, type: req.query.type, propertyId: req.query.propertyId,
  });
  sendSuccess(res, { data: result.inspections, meta: result.meta });
});

export const get = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.getInspection(req.params.id, req.user.organizationId, req.user);
  sendSuccess(res, { data: inspection });
});

export const schedule = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.scheduleInspection(req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { statusCode: 201, data: inspection, message: 'Inspection scheduled.' });
});

export const update = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.updateInspectionRecord(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: inspection, message: 'Inspection updated.' });
});

export const complete = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.completeInspection(req.params.id, req.user.organizationId, req.body, req.user, req);
  sendSuccess(res, { data: inspection, message: 'Inspection completed.' });
});

export const cancel = asyncHandler(async (req, res) => {
  const inspection = await inspectionService.cancelInspection(req.params.id, req.user.organizationId, req.user, req);
  sendSuccess(res, { data: inspection, message: 'Inspection cancelled.' });
});
