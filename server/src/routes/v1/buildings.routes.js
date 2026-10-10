import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as buildingController from '../../controllers/building.controller.js';
import {
  propertyIdParamSchema, buildingIdParamSchema, createBuildingSchema, updateBuildingSchema,
} from '../../validators/building.validators.js';

// Mounted at the v1 root (not under a `/buildings` prefix alone) so it can
// expose both the nested collection (`/properties/:propertyId/buildings`)
// and the standalone-by-id routes (`/buildings/:id`) — see routes/v1/index.js.
export const buildingsRouter = Router();

buildingsRouter.use(authenticate);

buildingsRouter.get('/properties/:propertyId/buildings', requirePermission('buildings:read'), validate(propertyIdParamSchema), buildingController.list);
buildingsRouter.post('/properties/:propertyId/buildings', csrfProtection, requirePermission('buildings:create'), validate(createBuildingSchema), buildingController.create);

buildingsRouter.get('/buildings/:id', requirePermission('buildings:read'), validate(buildingIdParamSchema), buildingController.get);
buildingsRouter.patch('/buildings/:id', csrfProtection, requirePermission('buildings:update'), validate(updateBuildingSchema), buildingController.update);
buildingsRouter.delete('/buildings/:id', csrfProtection, requirePermission('buildings:delete'), validate(buildingIdParamSchema), buildingController.remove);
