import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import {
  getFinancialSummary, getOccupancyReport, getRentCollectionReport, getMaintenanceSummaryReport,
} from '../services/financialReport.service.js';

export const financialSummary = asyncHandler(async (req, res) => {
  const summary = await getFinancialSummary(req.user.organizationId, req.user, {
    propertyId: req.query.propertyId, from: req.query.from, to: req.query.to,
  });
  sendSuccess(res, { data: summary });
});

export const occupancy = asyncHandler(async (req, res) => {
  const report = await getOccupancyReport(req.user.organizationId, req.user, { propertyId: req.query.propertyId });
  sendSuccess(res, { data: report });
});

export const rentCollection = asyncHandler(async (req, res) => {
  const report = await getRentCollectionReport(req.user.organizationId, req.user, {
    propertyId: req.query.propertyId, from: req.query.from, to: req.query.to,
  });
  sendSuccess(res, { data: report });
});

export const maintenanceSummary = asyncHandler(async (req, res) => {
  const report = await getMaintenanceSummaryReport(req.user.organizationId, req.user, { propertyId: req.query.propertyId });
  sendSuccess(res, { data: report });
});
