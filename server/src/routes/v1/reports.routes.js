import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { validate } from '../../middleware/validate.js';
import * as reportController from '../../controllers/report.controller.js';
import {
  financialSummarySchema, occupancyReportSchema, rentCollectionReportSchema, maintenanceSummaryReportSchema,
} from '../../validators/report.validators.js';

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.get('/financial-summary', requirePermission('reports:read'), validate(financialSummarySchema), reportController.financialSummary);
reportsRouter.get('/occupancy', requirePermission('reports:read'), validate(occupancyReportSchema), reportController.occupancy);
reportsRouter.get('/rent-collection', requirePermission('reports:read'), validate(rentCollectionReportSchema), reportController.rentCollection);
reportsRouter.get('/maintenance-summary', requirePermission('reports:read'), validate(maintenanceSummaryReportSchema), reportController.maintenanceSummary);
