import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { parsePagination } from '../utils/pagination.js';
import { listAuditLogs } from '../services/auditLog.service.js';

export const list = asyncHandler(async (req, res) => {
  const { page, pageSize, skip, take } = parsePagination(req.query);
  const result = await listAuditLogs(req.user.organizationId, {
    page, pageSize, skip, take,
    action: req.query.action, entityType: req.query.entityType, userId: req.query.userId,
    from: req.query.from, to: req.query.to,
  });
  sendSuccess(res, { data: result.entries, meta: result.meta });
});
