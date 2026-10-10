import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as unitController from '../../controllers/unit.controller.js';
import {
  unitIdParamSchema, listUnitsSchema, createUnitSchema, updateUnitSchema, setUnitStatusSchema,
} from '../../validators/unit.validators.js';

// Same nested + standalone mounting pattern as buildings.routes.js.
export const unitsRouter = Router();

unitsRouter.use(authenticate);

unitsRouter.get('/buildings/:buildingId/units', requirePermission('units:read'), validate(listUnitsSchema), unitController.list);
unitsRouter.post('/buildings/:buildingId/units', csrfProtection, requirePermission('units:create'), validate(createUnitSchema), unitController.create);

unitsRouter.get('/units/:id', requirePermission('units:read'), validate(unitIdParamSchema), unitController.get);
unitsRouter.patch('/units/:id', csrfProtection, requirePermission('units:update'), validate(updateUnitSchema), unitController.update);
unitsRouter.patch('/units/:id/status', csrfProtection, requirePermission('units:update'), validate(setUnitStatusSchema), unitController.setStatus);
unitsRouter.post('/units/:id/end-rental', csrfProtection, requirePermission('units:update'), validate(unitIdParamSchema), unitController.endRental);
unitsRouter.delete('/units/:id', csrfProtection, requirePermission('units:delete'), validate(unitIdParamSchema), unitController.remove);
