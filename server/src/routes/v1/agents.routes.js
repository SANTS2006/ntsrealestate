import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/authorize.js';
import { csrfProtection } from '../../middleware/csrf.js';
import { validate } from '../../middleware/validate.js';
import * as agentController from '../../controllers/agent.controller.js';
import { addAgentSchema, updateAgentSchema, agentLinkStatusSchema, linkParamSchema } from '../../validators/agent.validators.js';

export const agentsRouter = Router();

agentsRouter.use(authenticate);
agentsRouter.get('/', requirePermission('agents:read'), agentController.list);
agentsRouter.post('/', csrfProtection, requirePermission('agents:create'), validate(addAgentSchema), agentController.add);
agentsRouter.patch('/:linkId', csrfProtection, requirePermission('agents:update'), validate(updateAgentSchema), agentController.update);
agentsRouter.patch('/:linkId/status', csrfProtection, requirePermission('agents:update'), validate(agentLinkStatusSchema), agentController.setStatus);
agentsRouter.delete('/:linkId', csrfProtection, requirePermission('agents:delete'), validate(linkParamSchema), agentController.remove);
