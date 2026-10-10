import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as propertyController from '../../controllers/property.controller.js';
import {
  listPropertiesSchema, propertyIdParamSchema, createPropertySchema, updatePropertySchema,
  assignStaffSchema, unassignStaffSchema,
} from '../../validators/property.validators.js';

export const propertiesRouter = Router();

propertiesRouter.use(authenticate);

propertiesRouter.get('/', requirePermission('properties:read'), validate(listPropertiesSchema), propertyController.list);
propertiesRouter.get('/:id', requirePermission('properties:read'), validate(propertyIdParamSchema), propertyController.get);
propertiesRouter.post('/', csrfProtection, requirePermission('properties:create'), validate(createPropertySchema), propertyController.create);
propertiesRouter.patch('/:id', csrfProtection, requirePermission('properties:update'), validate(updatePropertySchema), propertyController.update);
propertiesRouter.delete('/:id', csrfProtection, requirePermission('properties:delete'), validate(propertyIdParamSchema), propertyController.archive);

propertiesRouter.get('/:id/assignments', requirePermission('properties:update'), validate(propertyIdParamSchema), propertyController.listAssignments);
propertiesRouter.post('/:id/assignments', csrfProtection, requirePermission('properties:update'), validate(assignStaffSchema), propertyController.assignStaff);
propertiesRouter.delete('/:id/assignments/:userId', csrfProtection, requirePermission('properties:update'), validate(unassignStaffSchema), propertyController.unassignStaff);
