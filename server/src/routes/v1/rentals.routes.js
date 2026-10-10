import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as rentalController from '../../controllers/rental.controller.js';
import { requestRentalSchema } from '../../validators/rental.validators.js';

export const rentalsRouter = Router();

rentalsRouter.use(authenticate);
rentalsRouter.post('/', csrfProtection, requirePermission('rentals:create'), validate(requestRentalSchema), rentalController.request);
rentalsRouter.get('/mine', requirePermission('rentals:read'), rentalController.mine);
rentalsRouter.get('/scope-options', requirePermission('rentals:read'), rentalController.scopeOptions);
