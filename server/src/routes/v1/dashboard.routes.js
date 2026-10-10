import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import * as dashboardController from '../../controllers/dashboard.controller.js';

export const dashboardRouter = Router();

// No requirePermission gate — every role gets a dashboard, just a
// different shape (dashboard.service.js branches on role internally: a
// tenant's own lease/balance vs. staff-wide KPIs, correctly scoped by
// assignment/ownership like every other property-hierarchy resource).
dashboardRouter.use(authenticate);
dashboardRouter.get('/', dashboardController.get);
